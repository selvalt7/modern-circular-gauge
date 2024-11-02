# Modern Circular Gauge

Modern gauge inspired and based on `ha-control-circular-slider`

![gauge_light](https://github.com/user-attachments/assets/85c04764-ab11-4677-92b6-3265ed8b0aea)
![gauge_dark](https://github.com/user-attachments/assets/4742d28e-5156-46ab-b3d1-f5d9eceb4d81)

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

### Card options

| Name | Type | Default | Description |
|------|:----:|:-------:|:------------|
| type | `string` | 'custom:modern-circular-gauge' |
| entity | `string` | Required | Entity
| name | `string` | Optional | Custom title
| min | `number` | `0` | Minimum gauge value
| max | `number` | `100` | Maximum gauge value
| unit | `string` | Optional | Custom unit
| header_position | `string` | `top` | Header position (`top`, `bottom`)
| needle | `boolean` | `false` | 
| segments | `list` | | Color segments list, see [color segments object](#color-segment-object)

### Color segment object
| Name | Type | Default | Description |
|------|:----:|:-------:|:------------|
| from | `number` | Required | Starting value of color segment
| color | `string` | Required | Color value of color segment
| label | `string` | Optional | Color segment label

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
