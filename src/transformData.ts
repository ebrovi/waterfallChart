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
    type: number // 1 value, 2 cumulative total
}

export function transformData(options: VisualUpdateOptions): VData {
    let data: VData;
    
     try {
        const dv = options.dataViews[0].categorical;

        let minValue = 0
        let maxValue = 0
        let total = 0
        
        const items: VDataItem[] = []
        const grouping: VDataItem[] = []

        for (let i = 0; i < dv.values.length; i++) { //4
            for (let u = 0; u < dv.categories[0].values.length; u++) { //12
                const value = dv.values[i].values[u]
                if (typeof value === "number" && !isNaN(value)){
                    total += <number>value;
                    maxValue = Math.max(maxValue, value)
                    minValue = Math.min(minValue, value)
                    items.push({
                        category: <string>dv.categories[0].values[u],
                        value: <number>value,
                        type: <number> 1 // 1 for value
                    })
                }
            }
            console.log("total",total)
            items.push({
                category: <string>dv.values[i].source.groupName,
                value: <number>total,
                type: <number> 2 // 2 for cumulative total
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
}
