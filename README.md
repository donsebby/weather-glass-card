# Weather Glass Card

A frosted-glass ("Liquid Glass") weather widget for Home Assistant Lovelace dashboards. Shows current conditions, an animated weather scene, a live clock, and a multi-day forecast with min/max temperature bars — all in a translucent, iOS-style glass panel.

![demo](asset/weather-glass-card.png)

## Features

- Frosted-glass panel with configurable blur, saturation, and brightness shading
- Animated weather scene (sun, moon, clouds, rain, snow, fog, lightning) rendered on canvas, with `prefers-reduced-motion` support
- Automatic day/night icon switching based on `sun.sun`, for weather integrations that don't report night-specific conditions (e.g. always `sunny` instead of `clear-night`)
- Live clock and localized German date/weekday header
- Configurable 3–7 day forecast with proportional min/max temperature bars
- Dirty-checked rendering — only re-renders when the displayed data actually changes, avoiding unnecessary DOM rebuilds and animation restarts
- Visual editor support (GUI card configuration, no YAML required)

## Installation

### HACS (recommended)

1. In HACS, go to **Frontend** → menu (⋮) → **Custom repositories**.
2. Add `https://github.com/donsebby/weather-glass-card` as category **Lovelace**.
3. Install **Weather Glass Card** and refresh your browser.

### Manual

1. Download `weather-glass-card.js` from the [latest release](https://github.com/donsebby/weather-glass-card/releases).
2. Copy it to `config/www/weather-glass-card.js`.
3. Add it as a dashboard resource:

   ```yaml
   resources:
     - url: /local/weather-glass-card.js
       type: module
   ```

## Configuration

| Option         | Type    | Default            | Description                                                              |
| -------------- | ------- | ------------------ | -------------------------------------------------------------------------- |
| `entity`       | string  | **required**       | A `weather.*` entity                                                     |
| `name`         | string  | entity friendly name | Title shown top-left                                                    |
| `days`         | number  | `5`                 | Number of forecast rows to show (3–7)                                    |
| `show_clock`   | boolean | `true`              | Show the live clock and date header                                      |
| `animations`   | boolean | `true`              | Enable the animated canvas weather scene                                 |
| `blur`         | number  | `20`                | Backdrop blur in px                                                       |
| `panel_shade`  | number  | `6`                 | Panel brightness; positive = lighter/whiter, negative = darker (-100–100) |

### Example

```yaml
type: custom:weather-glass-card
entity: weather.forecast_home
name: Zuhause
days: 5
show_clock: true
animations: true
blur: 20
panel_shade: 6
```

## Notes on day/night icons

Some weather integrations never emit night-specific conditions (e.g. `sunny` both day and night). This card checks `sun.sun` and swaps the icon/tint to a night variant (moon instead of sun) when the sun is below the horizon, while leaving the text label unchanged so it still reflects exactly what the entity reports.

## License

MIT
