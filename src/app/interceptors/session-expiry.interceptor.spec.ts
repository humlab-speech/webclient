import { isVispApiUrl } from './session-expiry.interceptor';

describe("isVispApiUrl", () => {
  it("matches relative PHP API paths", () => {
    expect(isVispApiUrl("/api/v1/upload")).toBeTrue();
    expect(isVispApiUrl("/api/v1/session")).toBeTrue();
  });

  it("matches absolute PHP API urls (project.service builds them from BASE_DOMAIN)", () => {
    expect(isVispApiUrl("https://visp.example.edu/api/v1/user/project/p1/session")).toBeTrue();
  });

  it("ignores the recorder's API, whose 401 is not a Visp sign-out", () => {
    expect(isVispApiUrl("/spr/api/v1/session/new")).toBeFalse();
  });

  it("ignores third-party hosts and lookalike paths", () => {
    expect(isVispApiUrl("https://nominatim.openstreetmap.org/search")).toBeFalse();
    expect(isVispApiUrl("/api/v1x/upload")).toBeFalse();
  });
});
