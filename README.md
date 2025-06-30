[![release][github-release]](https://github.com/selvalt7/modern-circular-gauge/releases/latest)
![downloads-latest][github-latest-downloads]
![downloads-total][github-downloads]
![stars][github-stars]

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/B0B016VT8K)
# Modern Circular Gauge

Modern look at the default Home Assistant gauge card

![cards](https://github.com/user-attachments/assets/91d0ad86-2851-4203-bc48-bb686001ecc1)

### Features
- Card and badge gauge
- Secondary info under the state with two size options
- Tertiary info above the state
- Sections support
- Needle
- Template support for `min`, `max`, `entity`, `name`, `icon`, `secondary` and `tertiary` (YAML only)
- Color segments with gradient
- Dual gauge
- Dual value representing as a dot on the same gauge
- Visual editor

## Install

### HACS

Modern circular gauge is available in [HACS](https://hacs.xyz/).

Simply click on the button to open the repository in HACS or just search for "Modern Circular Gauge" and download it through the UI.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=selvalt7&repository=modern-circular-gauge&category=plugin)

### Manual

1. Download `modern-circular-gauge.js` from [latest release](https://github.com/selvalt7/modern-circular-gauge/releases/latest)
2. Put `modern-circular-gauge.js` file into your `config/www` folder.
3. Add a reference to `modern-circular-gauge.js` via two ways:
    - **Via UI:** _Settings_ → _Dashboards_ → _More Options icon_ → _Resources_ → _Add Resource_ → Set _Url_ as `/local/modern-circular-gauge.js` → Set _Resource type_ as `JavaScript Module`.
      **Note:** If you do not see the Resources menu, you will need to enable _Advanced Mode_ in your _User Profile_

     [![Open your Home Assistant instance and show your dashboard resources.](https://my.home-assistant.io/badges/lovelace_resources.svg)](https://my.home-assistant.io/redirect/lovelace_resources/)

    - **Via YAML:** Add following code to `lovelace` section in your `configuration.yaml` file
      ```yaml
        resources:
            - url: /local/modern-circular-gauge.js
              type: module
      ```

## Options

Card and badge can be configured through visual editor or by `yaml`.
Templates are supported on selected options, configurable only via `yaml`.

### Card options

| Name | Type | Default | Description |
|------|:----:|:-------:|:------------|
| type | `string` | 'custom:modern-circular-gauge' |
| entity | `string` | Required | Entity. May contain templates
| name | `string` | Optional | Custom title. May contain templates
| icon | `string` | Optional | Custom icon. May contain [templates](https://www.home-assistant.io/docs/configuration/templating/)
| icon_entity | `primary` or `secondary` or `tertiary` | `primary` | Selects which entity to use for icon selection and color segments
| min | `number` or `string` | `0` | Minimum gauge value. May contain [templates](https://www.home-assistant.io/docs/configuration/templating/)
| max | `number` or `string` | `100` | Maximum gauge value. May contain [templates](https://www.home-assistant.io/docs/configuration/templating/) see [example](#gauge-with-templated-additional-info-and-segments)
| unit | `string` | Optional | Custom unit
| label | `string` | Optional | Label under the state, only used when `state_size` is set to `big`, see [secondary](#secondary-entity-object)
| label_font_size | `number` | `0.49em` | Label font size in px
| header_position | `top` or `bottom` | `bottom` | Header position
| show_state | `boolean` | `true` | Show entity state
| show_unit | `boolean` | `true` | Show state unit
| show_header | `boolean` | `true` | Show card header
| show_icon | `boolean` | `true` | Show card icon
| needle | `boolean` | `false` | 
| state_text | `string` | Entity state | Displayed state override. May contain [templates](https://www.home-assistant.io/docs/configuration/templating/)
| adaptive_icon_color | `boolean` | `false` | Makes icon color adaptive to current color segment
| adaptive_state_color | `boolean` | `false` | Makes state color adaptive to current color segment
| smooth_segments | `boolean` | `false` | Smooth color segments
| start_from_zero | `boolean` | `false` | Start gauge from zero instead of min
| state_font_size | `number` | `24` | Initial state size in px
| header_font_size | `number` | `14` | Gauge header font size in px
| header_offset | `number` | `0` | Gauge header vertical offset in px
| gauge_radius | `number` | `47` | Gauge radius
| gauge_background_style | `object` | Optional | Gauge background style, see [gauge element style object](#gauge-element-style-object)
| gauge_foreground_style | `object` | Optional | Gauge foreground style, see [gauge element style object](#gauge-element-style-object)
| segments | `list` | | Color segments list, see [color segments object](#color-segment-object)
| secondary | `object` or `string` | Optional | Secondary info to display under the state, see [secondary entity object](#secondary-entity-object). May contain [templates](https://www.home-assistant.io/docs/configuration/templating/) see [example](#gauge-with-templated-additional-info-and-segments)
| tertiary | `object` or `string` | Optional | Secondary info to display above the state, see [tertiary entity object](#Tertiary-entity-object). May contain [templates](https://www.home-assistant.io/docs/configuration/templating/) see [example](#gauge-with-templated-additional-info-and-segments)

### Badge options

| Name | Type | Default | Description |
|------|:----:|:-------:|:------------|
| type | `string` | 'custom:modern-circular-gauge-badge' |
| entity | `string` | Required | Entity. May contain templates.
| name | `string` | Optional | Custom title. May contain templates
| icon | `string` | Entity icon | Custom icon. May contain templates
| min | `number` or `string` | `0` | Minimum gauge value. May contain [templates](https://www.home-assistant.io/docs/configuration/templating/)
| max | `number` or `string` | `100` | Maximum gauge value. May contain [templates](https://www.home-assistant.io/docs/configuration/templating/)
| unit | `string` | Optional | Custom unit
| show_name | `bool` | `false` | Show badge name
| show_state | `bool` | `true` | Show entity state
| show_icon | `bool` | `true` | Show icon
| show_unit | `bool` | `true` | Show unit
| needle | `bool` | `false` | 
| start_from_zero | `boolean` | `false` | Start gauge from zero instead of min
| gauge_background_style | `object` | Optional | Gauge background style, see [gauge element style object](#gauge-element-style-object)
| gauge_foreground_style | `object` | Optional | Gauge foreground style, see [gauge element style object](#gauge-element-style-object)
| state_text | `string` | Entity state | Displayed state override. May contain [templates](https://www.home-assistant.io/docs/configuration/templating/)
| smooth_segments | `boolean` | `false` | Smooth color segments
| segments | `list` | | Color segments list, see [color segments object](#color-segment-object)

#### Color segment object
| Name | Type | Default | Description |
|------|:----:|:-------:|:------------|
| from | `number` | Required | Starting value of color segment. May contain templates
| color | `string` | Required | Color value of color segment. May contain templates
| label | `string` | Optional | Color segment label to display instead of state. May contain templates

#### Secondary entity object
| Name | Type | Default | Description |
|------|:----:|:-------:|:------------|
| entity | `string` | Optional | Secondary entity. May contain templates
| unit | `string` | Optional | Custom unit
| show_gauge | `none`, `inner`, `outter` | `none` | Display secondary info as dot on main gauge or on inner gauge
| min | `number` | Optional | Minimum inner gauge value. May contain templates
| max | `number` | Optional | Maximum inner gauge value. May contain templates
| label | `string` | Optional | Label under the state
| label_font_size | `number` | `0.49em` | Label font size in px
| state_size | `small` or `big` | `small` | Secondary state size 
| show_state | `boolean` | `true` | Show secondary state
| show_unit | `boolean` | `true` | Show secondary unit
| start_from_zero | `boolean` | `false` | Start gauge from zero instead of min
| state_font_size | `number` | `10` or `24` | State size in px
| gauge_radius | `number` | `42` | Gauge radius
| gauge_background_style | `object` | Optional | Gauge background style, see [gauge element style object](#gauge-element-style-object)
| gauge_foreground_style | `object` | Optional | Gauge foreground style, see [gauge element style object](#gauge-element-style-object)
| needle | `boolean` | `false` |
| adaptive_state_color | `boolean` | `false` | Makes state color adaptive to current color segment based on `show_gauge` config
| segments | `list` | | Color segments list, see [color segments object](#color-segment-object)

#### Tertiary entity object
| Name | Type | Default | Description |
|------|:----:|:-------:|:------------|
| entity | `string` | Optional | Secondary entity. May contain templates
| unit | `string` | Optional | Custom unit
| show_gauge | `none`, `inner`, `outter` | `none` | Display secondary info as dot on main gauge or on inner gauge
| min | `number` | Optional | Minimum inner gauge value. May contain templates
| max | `number` | Optional | Maximum inner gauge value. May contain templates
| label | `string` | Optional | Label above the state
| label_font_size | `number` | `0.49em` | Label font size in px
| show_state | `boolean` | `true` | Show secondary state
| show_unit | `boolean` | `true` | Show secondary unit
| start_from_zero | `boolean` | `false` | Start gauge from zero instead of min
| state_font_size | `number` | `10` | State size in px
| gauge_radius | `number` | `37` | Gauge radius
| gauge_background_style | `object` | Optional | Gauge background style, see [gauge element style object](#gauge-element-style-object)
| gauge_foreground_style | `object` | Optional | Gauge foreground style, see [gauge element style object](#gauge-element-style-object)
| needle | `boolean` | `false` |
| adaptive_state_color | `boolean` | `false` | Makes state color adaptive to current color segment based on `show_gauge` config
| segments | `list` | | Color segments list, see [color segments object](#color-segment-object)

#### Gauge element style object
| Name | Type | Default | Description |
|------|:----:|:-------:|:------------|
| width | `number` | `6 or 4`, `14` for badge | Gauge element width
| color | `string` or `adaptive` | Optional | Gauge element color
| opacity | `number` | Optional | Gauge element opacity

## Examples

### Simple gauge

![simple_gauge](https://github.com/user-attachments/assets/3b895d21-2f03-4eea-903a-43590e687846)

```yaml
type: custom:modern-circular-gauge
entity: sensor.power_consumption
max: 1000
```

### Gauge with additional info

![simple_gauge_secondary_info](https://github.com/user-attachments/assets/93a411ef-88b1-477b-b6f7-896cdc32dbff)

```yaml
type: custom:modern-circular-gauge
entity: sensor.power_consumption
secondary:
  entity: sensor.voltage
max: 1000
```

### Gauge with templated additional info and segments

![gauge_templates](https://github.com/user-attachments/assets/b4cc720b-7433-4729-b09e-3800ea578de3)

```yaml
type: custom:modern-circular-gauge
entity: sensor.room_temp
unit: °C
name: Temperature
secondary: >-
  {% if is_state("binary_sensor.room_temp_rising", "on") %} Rising {% elif
  is_state("binary_sensor.room_temp_falling", "on") %} Falling {% endif %}
max: "{{states('input_number.max_number')}}"
min: 10
header_position: bottom
needle: true
segments:
  - from: 13
    color:
      - 11
      - 182
      - 239
  - from: 19
    color:
      - 43
      - 255
      - 0
  - from: 24
    color:
      - 252
      - 161
      - 3
```

### Gauge with bigger secondary and labels

![labels](https://github.com/user-attachments/assets/9f696eef-6918-4bfc-8559-91c6d8de8b52)

```yaml
type: custom:modern-circular-gauge
entity: sensor.power_consumption
label: Power
max: 1000
tap_action:
  action: none
secondary:
  entity: sensor.voltage
  state_size: big
  label: Voltage
header_position: bottom
name: Power plug
```

### Dual gauge

![dual_gauge](https://github.com/user-attachments/assets/cb5b3f5a-7aa6-455d-b571-c1844257a78c)

```yaml
type: custom:modern-circular-gauge
name: Dual gauge
min: 10
needle: false
secondary:
  entity: sensor.target_room_temp
  unit: °C
  show_gauge: inner
  min: 10
  max: 30
max: 30
entity: sensor.room_temp
unit: °C
```

### Templated icon

![templated icon](https://github.com/user-attachments/assets/afc49437-5bbe-4d6a-aa80-e7d402e61800)

```yaml
type: custom:modern-circular-gauge
entity: sensor.room_temp
unit: °C
name: Temperature
icon: >-
  {% if is_state("binary_sensor.room_temp_rising", "on")
  %}mdi:thermometer-chevron-up{% elif is_state("binary_sensor.room_temp_falling",
  "on") %}mdi:thermometer-chevron-down{% endif %}
max: 30
min: 10
needle: true
smooth_segments: true
adaptive_icon_color: true
segments:
  - from: 13
    color:
      - 11
      - 182
      - 239
  - from: 19
    color:
      - 43
      - 255
      - 0
  - from: 24
    color:
      - 252
      - 161
      - 3
```
### Gradient background and foreground

![brave_xfJk28FEFZ](https://github.com/user-attachments/assets/225f7236-a11c-4836-8248-142e307ff903)

```yaml
type: custom:modern-circular-gauge
entity: sensor.room_temp
unit: °C
name: Temperature
gauge_foreground_style:
  color: adaptive
gauge_background_style:
  width: 2
  color: adaptive
max: 30
min: 10
smooth_segments: true
adaptive_icon_color: true
segments:
  - from: 13
    color:
      - 11
      - 182
      - 239
  - from: 19
    color:
      - 43
      - 255
      - 0
  - from: 24
    color:
      - 252
      - 161
      - 3
  - color:
      - 255
      - 0
      - 0
    from: 30
```

### Remaining timer

Requires sensor with remaining timer seconds.

![timer](https://github.com/user-attachments/assets/2ecf0810-42ca-435e-8057-407e9412311c)

```yaml
type: custom:modern-circular-gauge
entity: sensor.timer_remaining_seconds
needle: true
state_text: "{{ states('sensor.timer_remaining_seconds') | int | timestamp_custom('%M:%S', false) }}"
name: Timer
gauge_background_style:
  color: aqua
  opacity: 0.2
icon: mdi:clock
min: 0
max: 210
tap_action:
  action: more-info
  entity: timer.awesome_timer

```

## Development

1. Clone this repository into your `config/www` folder using git:
```
$ git clone https://github.com/selvalt7/modern-circular-gauge.git
```
2. Add a reference to the card as shown [here](#manual)


### Instructions

*Requires `nodejs` & `npm`.*

1. Move into the `modern-circular-gauge` repo, checkout the *dev* branch & install dependencies:
```console
$ cd modern-circular-gauge && git checkout dev && npm install
```

2. Make changes to the source code.

3. Build the source by running:
```console
$ npm run build
```
The new `modern-circular-gauge.js` will be build in `dist` folder

4. Refresh your browser to see changes
   
   **Note:** Make sure to disable browser cache

[gitHub-release]: https://img.shields.io/github/v/release/selvalt7/modern-circular-gauge?style=flat
[github-downloads]: https://img.shields.io/github/downloads/selvalt7/modern-circular-gauge/total?style=flat
[github-latest-downloads]: https://img.shields.io/github/downloads/selvalt7/modern-circular-gauge/latest/total?style=flat
[github-stars]: https://img.shields.io/github/stars/selvalt7/modern-circular-gauge?style=flat
