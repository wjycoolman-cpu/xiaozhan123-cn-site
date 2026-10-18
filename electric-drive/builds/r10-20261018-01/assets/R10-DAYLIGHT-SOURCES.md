# R10 day / dusk environments

This revision reuses the R9 scene and all of its independent asset licenses.

## Daytime HDR

- Asset: Kloofendal 48d Partly Cloudy (Pure Sky), 2K Radiance HDR.
- Original by Greg Zaal; sky edits by Jarod Guest.
- Source: https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky
- Original download: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr
- License: CC0 1.0, https://polyhaven.com/license
- Bundled file: assets/sky/kloofendal_48d_partly_cloudy_puresky_2k.hdr
- Size: 5,451,493 bytes. Official API MD5 2eba3a4d7eeb23cbfbeca364c97e7980, verified against the downloaded file.
- SHA256: 5244534e9cf5b606f2ff513aa00ddb161b0a4826ffd88a0d3bd03ac29247d198
- Applied as actual HDR sky radiance and cached physical material environment.
- The brightest source sun direction is measured and aligned with the sun light;
  peak radiance is capped in the sky shader to preserve a stable web renderer.

## Dusk and city

The existing Qwantani Sunset (Pure Sky) source retains its photographic clouds,
with a brighter dusk grade and matching environment fill. Its original source
and CC0 license remain in assets/sky/SOURCE_AND_LICENSE.md.

The real city and sky are captured into one hero reflection map per time of day
at load. The reflection camera far plane includes the actual 500m sky sphere.
No reflection capture runs per gameplay frame or on subsequent setting changes.

Existing ORCA Bistro (CC BY 4.0), Emerald (CC BY-NC-SA 3.0), vehicle,
Poly Haven facade/road, Kenney and Three licenses remain unchanged. This extra
CC0 sky does not relicense the independent city assets.
