'use strict'

import powerbi from "powerbi-visuals-api"
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions
import IVisualHost = powerbi.extensibility.visual.IVisualHost
import ISelectionId = powerbi.extensibility.ISelectionId


export interface VData {
    //array with data points where every point has their own category with a value
    items: VDataItem[],
    minValue: number,
    maxValue: number,
    total: number,
    grouping: VDataItem[],
    formatString: string, 
}

export interface VDataItem {
    category: string,
    value: number,
    type: number, // 1 value, 2 cumulative total
    color: string
}

export function transformData(options: VisualUpdateOptions, barColors: string[]): VData { // 3 dif colors
    let data: VData;

    try {
        const dv = options.dataViews[0].categorical;
        let minValue = 0;
        let maxValue = 0;
        let total = 0;
        
        const items: VDataItem[] = [];
        const grouping: VDataItem[] = [];

        for (let i = 0; i < dv.values.length; i++) {
            for (let u = 0; u < dv.categories[0].values.length; u++) {
                const value = dv.values[i].values[u];

                if (typeof value === "number" && !isNaN(value)) {
                    total += value;
                    minValue = Math.min(minValue, total, value);
                    maxValue = Math.max(maxValue, total, value);

                    let colorIndex = value > 0 ? 0 : 1
                    let color = barColors[colorIndex] 

                    items.push({
                        category: <string>dv.categories[0].values[u],
                        value: <number>value,
                        type: <number> 1, // 1 for value,
                        color: color
                    })
                }
            }

            let sumColor = barColors[2]
            items.push({
                category: <string>dv.values[i].source.groupName,
                value: <number>total,
                type: <number> 2, // 2 for cumulative total
                color: sumColor,
            })
        }

        data = {
            items,
            minValue,
            maxValue,
            total,
            grouping,
            formatString: dv.values[0].source.format || ''
        };

    } catch (error) {
        console.error('Error in transformData:', error);
        data = {
            items: [],
            minValue: 0,
            maxValue: 0,
            total: 0,
            grouping: [],
            formatString: ''
        };
    }

    return data;
}
/*export function transformData(options: VisualUpdateOptions, defaultColor: string): VData {
    let data: VData;
    
     try {
        const dv = options.dataViews[0].categorical;

        let minValue = 0
        let maxValue = 0
        let total = 0
        let color: string
        
        const items: VDataItem[] = []
        const grouping: VDataItem[] = []

        for (let i = 0; i < dv.values.length; i++) { //4
            try {
                    color = dv.categories[0].objects[i].waterfallSettings.barColor['solid'].color;
                } catch(error) {
                    color = defaultColor;
                }
            for (let u = 0; u < dv.categories[0].values.length; u++) { //12
                const value = dv.values[i].values[u]
                try {
                    color = dv.categories[0].objects[i].waterfallSettings.barColor['solid'].color;
                } catch(error) {
                    color = defaultColor;
                }
                if (typeof value === "number" && !isNaN(value)){
                    total += value;
                
                    total < minValue ? minValue = Math.min(total, value) : maxValue = Math.max(total, value)
                    console.log("total",total, "min", minValue, "max", maxValue)
                    items.push({
                        category: <string>dv.categories[0].values[u],
                        value: <number>value,
                        type: <number> 1, // 1 for value,
                        color,
                    })
                }
            }
            items.push({
                category: <string>dv.values[i].source.groupName,
                value: <number>total,
                type: <number> 2, // 2 for cumulative total
                color,
            })
            data = {
                items,
                minValue,
                maxValue,
                total,
                grouping,
                formatString: dv.values[0].source.format || '',
            }
        }

    } catch (error) {
        console.error('Error in transformData:', error);
        data = {
            items: [],
            minValue: 0,
            maxValue: 0,
            total: 0,
            grouping: [],
            formatString: '',
        };
    } 
    return data;
}*/
