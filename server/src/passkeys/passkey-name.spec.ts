import { defaultPasskeyName, nameFromUserAgent } from './passkey-name';

const UA = {
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.0.0 Mobile/15E148 Safari/604.1',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 15; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0',
};

describe('nameFromUserAgent', () => {
  it.each([
    [UA.macChrome, 'Mac Chrome'],
    [UA.macSafari, 'Mac Safari'],
    [UA.iphoneSafari, 'iPhone Safari'],
    [UA.iphoneChrome, 'iPhone Chrome'],
    [UA.windowsEdge, 'Windows Edge'],
    [UA.androidSamsung, 'Android Samsung Internet'],
    [UA.linuxFirefox, 'Linux Firefox'],
  ])('%s', (ua, expected) => {
    expect(nameFromUserAgent(ua)).toBe(expected);
  });

  it('알 수 없는 UA는 null', () => {
    expect(nameFromUserAgent('curl/8.0')).toBeNull();
    expect(nameFromUserAgent(undefined)).toBeNull();
  });
});

describe('defaultPasskeyName', () => {
  it('UA로 못 정하면 패스키 N', () => {
    expect(defaultPasskeyName('curl/8.0', 2)).toBe('패스키 3');
    expect(defaultPasskeyName(UA.macChrome, 2)).toBe('Mac Chrome');
  });
});
