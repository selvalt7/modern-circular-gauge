# Modern Circular Gauge

Modern look at the default Home Assistant gauge card

![cards](https://github.com/user-attachments/assets/25a5446f-fee3-461e-b028-2304f5e7796f)

### Features
- Card and badge gauge
- Secondary info under the state with two size options
- Sections support
- Needle
- Template support for `min`, `max`, `entity` and `secondary` (YAML only)
- Color segments with gradient
- Dual gauge
- Dual value representing as a dot on the same gauge
- Visual editor

## Install

### HACS

Add this repository via [HACS](https://hacs.xyz/) custom repositories for easy update

https://github.com/selvalt7/modern-circular-gauge

([How to add Custom Repositories](https://hacs.xyz/docs/faq/custom_repositories/))

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
| name | `string` | Optional | Custom title
| min | `number` or `string` | `0` | Minimum gauge value. May contain [templates](https://www.home-assistant.io/docs/configuration/templating/)
| max | `number` or `string` | `100` | Maximum gauge value. May contain [templates](https://www.home-assistant.io/docs/configuration/templating/) see [example](#gauge-with-templated-additional-info-and-segments)
| unit | `string` | Optional | Custom unit
| label | `string` | Optional | Label under the state, only used when `state_size` is set to `big`, see [secondary](#secondary-entity-object)
| header_position | `top` or `bottom` | `bottom` | Header position
| needle | `boolean` | `false` | 
| smooth_segments | `boolean` | `false` | Smooth color segments
| segments | `list` | | Color segments list, see [color segments object](#color-segment-object)
| secondary | `object` or `string` | Optional | Secondary info to display under the state, see [secondary entity object](#secondary-entity-object). May contain [templates](https://www.home-assistant.io/docs/configuration/templating/) see [example](#gauge-with-templated-additional-info-and-segments)

### Badge options

| Name | Type | Default | Description |
|------|:----:|:-------:|:------------|
| type | `string` | 'custom:modern-circular-gauge-badge' |
| entity | `string` | Required | Entity. May contain templates.
| name | `string` | Optional | Custom title
| icon | `string` | Entity icon | Custom icon
| min | `number` or `string` | `0` | Minimum gauge value. May contain [templates](https://www.home-assistant.io/docs/configuration/templating/)
| max | `number` or `string` | `100` | Maximum gauge value. May contain [templates](https://www.home-assistant.io/docs/configuration/templating/)
| unit | `string` | Optional | Custom unit
| show_name | `bool` | `false` | Show badge name
| show_state | `bool` | `true` | Show entity state
| show_icon | `bool` | `false` | Show icon
| needle | `bool` | `false` | 
| smooth_segments | `boolean` | `false` | Smooth color segments
| segments | `list` | | Color segments list, see [color segments object](#color-segment-object)

#### Color segment object
| Name | Type | Default | Description |
|------|:----:|:-------:|:------------|
| from | `number` | Required | Starting value of color segment
| color | `string` | Required | Color value of color segment
| label | `string` | Optional | Color segment label to display instead of state

#### Secondary entity object
| Name | Type | Default | Description |
|------|:----:|:-------:|:------------|
| entity | `string` | Optional | Secondary entity. May contain templates
| unit | `string` | Optional | Custom unit
| show_gauge | `none`, `inner`, `outter` | `none` | Display secondary info as dot on main gauge or on inner gauge
| min | `number` | Optional | Minimum inner gauge value. May contain templates
| max | `number` | Optional | Maximum inner gauge value. May contain templates
| label | `string` | Optional | Label under the state, only used when `state_size` is set to `big`
| state_size | `small` or `big` | `small` | Secondary state size 
| needle | `boolean` | `false` |
| segments | `list` | | Color segments list, see [color segments object](#color-segment-object)

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
