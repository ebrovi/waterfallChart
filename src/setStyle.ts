'use strict'

import {VisualSettings} from "./settings" 

// här deklareras --namnen för allt som används i visual.less 

export function setStyle(settings: VisualSettings): void {
    const style = document.documentElement.style

    style.setProperty('--default-color', settings.waterfallSettings.defaultColor),
    style.setProperty('--bar-color', settings.waterfallSettings.barColor),
    style.setProperty('--font-family', settings.waterfallSettings.fontFamily),
    style.setProperty('--font-size', `${settings.waterfallSettings.fontSize}pt`),
    style.setProperty('--font-color', settings.waterfallSettings.fontColor),
    style.setProperty('--line-width', `${settings.waterfallSettings.lineWidth}`),
    style.setProperty('--connector-width', `${settings.waterfallSettings.connectorWidth}`)
} 