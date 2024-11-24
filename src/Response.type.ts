export interface Response {
  scan: {
    algorithmVersion: number;
    grade: string;
    error: string | null;
    score: number;
    statusCode: number;
    testsFailed: number;
    testsPassed: number;
    testsQuantity: number;
    responseHeaders: {
      [key: string]: string;
    };
  };
  tests: {
    'content-security-policy': {
      expectation: 'csp-implemented-with-no-unsafe';
      pass: boolean;
      result: string;
      scoreModifier: number;
      data: {
        [key: string]: string[];
      };
      http: boolean;
      meta: boolean;
      policy: {
        antiClickjacking: boolean;
        defaultNone: boolean;
        insecureBaseUri: boolean;
        insecureFormAction: boolean;
        insecureSchemeActive: boolean;
        insecureSchemePassive: boolean;
        strictDynamic: boolean;
        unsafeEval: boolean;
        unsafeInline: boolean;
        unsafeInlineStyle: boolean;
        unsafeObjects: boolean;
      };
      numPolicies: number;
    };
    cookies: {
      expectation: 'cookies-secure-with-httponly-sessions';
      pass: boolean;
      result: string;
      scoreModifier: number;
      data: {
        [key: string]: {
          domain: string;
          expires: string;
          httponly: boolean;
          path: string;
          port: number | null;
          samesite: string;
          secure: boolean;
        };
      };
      sameSite: boolean;
    };
    'cross-origin-resource-sharing': {
      expectation: 'cross-origin-resource-sharing-not-implemented';
      pass: boolean;
      result: string;
      scoreModifier: number;
      data: string | null;
    };
    redirection: {
      expectation: 'redirection-to-https';
      pass: boolean;
      result: string;
      scoreModifier: number;
      destination: string;
      redirects: boolean;
      route: string[];
      statusCode: number;
    };
    'referrer-policy': {
      expectation: 'referrer-policy-private';
      pass: boolean;
      result: string;
      scoreModifier: number;
      data: string;
      http: boolean;
      meta: boolean;
    };
    'strict-transport-security': {
      expectation: 'hsts-implemented-max-age-at-least-six-months';
      pass: boolean;
      result: string;
      scoreModifier: number;
      data: string;
      includeSubDomains: boolean;
      maxAge: number;
      preload: boolean;
      preloaded: boolean;
    };
    'subresource-integrity': {
      expectation: 'sri-implemented-and-external-scripts-loaded-securely';
      pass: boolean;
      result: string;
      scoreModifier: number;
      data: {
        [key: string]: {
          crossorigin: string | null;
          integrity: string | null;
        };
      };
    };
    'x-content-type-options': {
      expectation: 'x-content-type-options-nosniff';
      pass: boolean;
      result: string;
      scoreModifier: number;
      data: string;
    };
    'x-frame-options': {
      expectation: 'x-frame-options-sameorigin-or-deny';
      pass: boolean;
      result: string;
      scoreModifier: number;
      data: string;
    };
    'cross-origin-resource-policy': {
      expectation: 'corp-implemented-with-same-site';
      pass: boolean;
      result: string;
      scoreModifier: number;
      data: string | null;
      http: boolean;
      meta: boolean;
    };
  };
}
