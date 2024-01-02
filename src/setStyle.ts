'use strict'

import {VisualSettings} from "./settings" 

// här deklareras --namnen för allt som används i visual.less 

export function setStyle(settings: VisualSettings): void {
    const style = document.documentElement.style
    style.setProperty('--pos-bar-color', settings.waterfallSettings.posBarColor),
    style.setProperty('--neg-bar-color', settings.waterfallSettings.negBarColor),
    style.setProperty('--sum-bar-color', settings.waterfallSettings.sumBarColor),
    style.setProperty('--font-family', settings.waterfallSettings.fontFamily),
    style.setProperty('--font-size', `${settings.waterfallSettings.fontSize}pt`),
    style.setProperty('--font-color', settings.waterfallSettings.fontColor),
    style.setProperty('--line-width', `${settings.waterfallSettings.lineWidth}`),
    style.setProperty('--connector-width', `${settings.waterfallSettings.connectorWidth}`),
    style.setProperty('--line-color', settings.waterfallSettings.lineColor),
    style.setProperty('--data-font-family', settings.waterfallSettings.dataFontFamily),
    style.setProperty('--data-font-size', `${settings.waterfallSettings.dataFontSize}pt`),
    style.setProperty('--data-font-color', settings.waterfallSettings.dataFontColor),
    style.setProperty('--gridline-color', settings.waterfallSettings.gridlineColor),
    style.setProperty('--gridline-width', `${settings.waterfallSettings.gridlineWidth}`)
} 