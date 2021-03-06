import { AppAuth } from 'expo-app-auth';
import { UnavailabilityError } from 'expo-errors';
import { Platform } from 'react-native';

export type LogInConfig = {
  androidClientId?: string;
  iosClientId?: string;
  clientId: string;
  behavior?: 'system' | 'web';
  scopes?: string[];
};

export type GoogleUser = {
  id?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  photoUrl?: string;
  email?: string;
};

export type LogInResult =
  | {
      type: 'cancel';
    }
  | {
      type: 'success';
      accessToken?: string;
      idToken: string | null;
      refreshToken: string | null;
      user: GoogleUser;
    };

export async function logInAsync(config: LogInConfig): Promise<LogInResult> {
  if (!AppAuth.authAsync) {
    throw new UnavailabilityError('AppAuth', 'logInAsync');
  }

  if (config.behavior !== undefined) {
    console.warn(
      "Deprecated: Native Google Sign-In has been moved to Expo.GoogleSignIn ('expo-google-sign-in') Falling back to `web` behavior. `behavior` deprecated in SDK 34"
    );
  }

  const userDefinedScopes = config.scopes || [];
  /* Add the required scopes for returning profile data. */
  const requiredScopes = [...userDefinedScopes, 'profile', 'email', 'openid'];
  /* Remove duplicates */
  const scopes = [...new Set(requiredScopes)];

  /* This is the CLIENT_ID generated from a Firebase project */
  const clientId =
    config.clientId ||
    Platform.select({
      ios: config.iosClientId,
      android: config.androidClientId || config['androidStandaloneAppClientId'],
      web: config.clientId || config['iosStandaloneAppClientId'],
    });

  if (
    config.iosClientId ||
    config.androidClientId ||
    config['androidStandaloneAppClientId'] ||
    config['iosStandaloneAppClientId']
  ) {
    console.warn(
      'Expo.Google.logInAsync(): `iosClientId`, `androidClientId`, `iosStandaloneAppClientId`, and `androidStandaloneAppClientId` have been deprecated and will be removed in SDK 34 in favor of `clientId`'
    );
  }

  try {
    const logInResult = await AppAuth.authAsync({
      issuer: 'https://accounts.google.com',
      scopes,
      clientId,
    });

    // Web login only returns an accessToken so use it to fetch the same info as the native login
    // does.
    const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
      headers: { Authorization: `Bearer ${logInResult.accessToken}` },
    });
    const userInfo = await userInfoResponse.json();
    return {
      type: 'success',
      ...logInResult,
      user: {
        id: userInfo.id,
        name: userInfo.name,
        givenName: userInfo.given_name,
        familyName: userInfo.family_name,
        photoUrl: userInfo.picture,
        email: userInfo.email,
      },
    };
  } catch (error) {
    if (error.message.toLowerCase().indexOf('user cancelled') > -1) {
      return { type: 'cancel' };
    }
    throw error;
  }
}

export async function logOutAsync({ accessToken, clientId }): Promise<any> {
  const config = {
    issuer: 'https://accounts.google.com',
    clientId,
  };

  return await AppAuth.revokeAsync(config, {
    token: accessToken,
    isClientIdProvided: !!clientId,
  });
}
