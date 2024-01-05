/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import VisualEnumerationInstanceKinds = powerbi.VisualEnumerationInstanceKinds;
import IVisualHost = powerbi.extensibility.visual.IVisualHost
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import {valueFormatter, textMeasurementService} from "powerbi-visuals-utils-formattingutils";
import measureSvgTextWidth = textMeasurementService.measureSvgTextWidth;

import { Selection, select, selectAll, BaseType} from "d3-selection";
import { VisualSettings } from "./settings";
import { transformData, VData } from "./transformData"
import { transition, Transition} from "d3-transition"
import { easeLinear } from "d3-ease"
import { setStyle } from "./setStyle"
import { ScalePoint, scalePoint, ScaleLinear, scaleLinear} from "d3-scale";
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";

export class Visual implements IVisual {
    private target: HTMLElement;
    private settings: VisualSettings;
    private data: VData;
    private host: IVisualHost
    private svg: Selection<SVGElement, any, HTMLElement, any>
    private dim: [number, number]
    private scaleX: ScalePoint<string>
    private scaleY: ScaleLinear<number, number>
    private transition: Transition<BaseType, unknown, null, undefined>

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.host = options.host;
        if (document) {
            this.svg = select(this.target).append('svg')
        }
    }

    public update(options: VisualUpdateOptions) {
        this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
        console.log('Visual update', options);
        let colors = [
            this.settings.waterfallSettings.posBarColor, 
            this.settings.waterfallSettings.negBarColor, 
            this.settings.waterfallSettings.sumBarColor];
        
        const hideStart = this.settings.waterfallSettings.hideStart

        this.data = transformData(options, colors, hideStart)
        console.log("this.data", this.data)
        
        setStyle(this.settings)
        this.dim = [options.viewport.width, options.viewport.height]
        this.svg.attr('width', this.dim[0])   
        this.svg.attr('height', this.dim[1])

        const maxLen = this.getTextWidth(this.formatMeasure(this.data.maxValue, this.data.formatString)) * 1.5
        const minLen = this.getTextWidth(this.formatMeasure(this.data.minValue, this.data.formatString)) * 1.5
        const xMargin = Math.max(maxLen, minLen) // margin is the largest out of the values displayed on the y-axis

        this.scaleX = scalePoint()
            .domain(Array.from(this.data.items, d => d.category))
            .range([xMargin, this.dim[0]-this.settings.waterfallSettings.fontSize/2])
            .padding(0.5)
    
        const baseline = this.dim[1] - this.settings.waterfallSettings.fontSize*2 -this.settings.waterfallSettings.lineWidth    // ----------------------- FÖRBÄTTRA -----------------------------------

        this.scaleY = scaleLinear()
            .domain([this.data.minValue, this.data.maxValue + this.settings.waterfallSettings.fontSize])
            .range([baseline - this.settings.waterfallSettings.dataFontSize*2.5, this.settings.waterfallSettings.fontSize + this.settings.waterfallSettings.dataFontSize*2.5]) // so bars dont go over categories

        this.transition = transition().duration(500).ease(easeLinear)

        interface barObject {
            startY: number,
            dir: number,
            value: number
        }

        let prevH = this.scaleY(0);
        let barArray: barObject[] = []; 

        for (let i = 0; i < this.data.items.length; i++) {
            const currentItem = this.data.items[i];
            let height = Math.abs(this.scaleY(0) - this.scaleY(currentItem.value));
            let startY;
        
            if (currentItem.type < 2) {
                startY = (currentItem.value < 0) ? prevH : prevH - height;
                prevH += (currentItem.value < 0) ? height : - height;
            } else if (currentItem.type === 2) {
                startY = currentItem.value < 0
                         ? this.scaleY(0) 
                         : this.scaleY(currentItem.value);
                if (i === 0) {
                    prevH += (currentItem.value < 0) ? height : - height;
                }
            }

            barArray.push({
                startY: startY,
                dir: currentItem.value < 0 ? -1 : 1,
                value: height
            });

        }

        const {yMin, yMax, stepSize} = this.getMinMaxSteps(this.data.minValue, this.data.maxValue)

        const ySteps = this.getYVal(baseline, yMin, yMax, stepSize) // försökte göra detta separat men får ej att funka i funktionerna

        this.defGradients(colors) 
        this.drawYAxis(baseline, xMargin, yMin, yMax, stepSize)
        this.drawXAxis(xMargin)
        this.drawCategoryLabels()
        this.drawConnectors(barArray)
        this.drawDataLabel(barArray)
        this.drawBars(barArray)
        
        
    }

    private static parseSettings(dataView: DataView): VisualSettings {
        return <VisualSettings>VisualSettings.parse(dataView);
    }

    private drawXAxis(sideMargin) {
        const xAxis = this.svg.selectAll('line.x-axis').data([0]) // Binding a single-element array
          
        xAxis.enter().append('line')
            .classed('x-axis', true)
            .attr('x1', sideMargin)
            .attr('y1', this.scaleY(0))
            .attr('x2', this.scaleX.range()[1] )
            .attr('y2', this.scaleY(0))

        xAxis.transition(this.transition)
            .attr('x1', sideMargin)
            .attr('y1', this.scaleY(0))
            .attr('x2', this.scaleX.range()[1] )
            .attr('y2', this.scaleY(0))

        xAxis.exit().remove()
    
    }

    private calculateRoundingFactor(range, numSteps) {
        // här beräknas vad storleken på varje steg 
        const stepSize = range / numSteps;
        const magnitude = Math.pow(10, Math.floor(Math.log10(stepSize)));
        const normalizedStepSize = stepSize / magnitude; // Normalize step size to between 1 and 10
        let roundedStepSize;
        if (normalizedStepSize < 1.5) {
            roundedStepSize = 1;
        } else if (normalizedStepSize < 3) {
            roundedStepSize = 2;
        } else if (normalizedStepSize < 7.5) {
            roundedStepSize = 5;
        } else {
            roundedStepSize = 10;
        }
        return roundedStepSize * magnitude; // Scale back to the original magnitude
    }
    
    private getMinMaxSteps(minValue, maxValue) {
        const positiveRange = maxValue > 0 ? maxValue : 0;
        const negativeRange = minValue < 0 ? Math.abs(minValue) : 0;

        const dif = Math.abs(maxValue - minValue)

        const posPerc = (maxValue+0.01)/dif // +0.01 if maxValue = 0

        const posSteps = Math.ceil(posPerc*10)
        const negSteps = Math.ceil(10-posPerc*10+0.01)
    
        const positiveStep = this.calculateRoundingFactor(positiveRange, posSteps );
        const negativeStep = this.calculateRoundingFactor(negativeRange, negSteps);

        const stepSize = Math.max(positiveStep, negativeStep);
    
        // new min max based on largest stepsize
        const yMin = Math.floor(minValue / stepSize) * stepSize;
        const yMax = Math.ceil(maxValue / stepSize) * stepSize;
    
        return { yMin, yMax, stepSize };
    }
    
    private getYVal(baseline, yMin, yMax, stepSize) {
        let yValues = []; 

        for (let value = yMin; value <= yMax; value += stepSize) {
            let scaledValue = this.scaleY(value)
            if (scaledValue < baseline && scaledValue > this.settings.waterfallSettings.fontSize) {
                yValues.push({
                    value: value, 
                    scaledValue: scaledValue
                });
            }
        }

        return yValues;
    }

    private drawYAxis(baseline, xMargin, yMin, yMax, stepSize) {
        const yAxis = this.svg.selectAll('line.y-axis').data([0]); 

        let tickValues = []; 

        for (let value = yMin; value <= yMax; value += stepSize) {
            let scaledValue = this.scaleY(value)
            if (scaledValue < baseline && scaledValue > this.settings.waterfallSettings.fontSize) {
                tickValues.push({
                    value: value, 
                    scaledValue: scaledValue
                });
            }
        }


        // ---------------------------------- Y-AXIS -----------------------------------------
    
        yAxis.enter().append('line')
            .classed('y-axis', true)
            .attr('x1', xMargin)
            .attr('y1', this.settings.waterfallSettings.fontSize)
            .attr('x2', xMargin)
            .attr('y2', baseline);
        
        yAxis.transition(this.transition)
            .attr('x1', xMargin)
            .attr('y1', this.settings.waterfallSettings.fontSize)
            .attr('x2', xMargin)
            .attr('y2', baseline);


        // ---------------------------------- TICKS -----------------------------------------

        const ticks = this.svg.selectAll('line.y-tick').data(tickValues);
        ticks.enter().append('line')
            .classed('y-tick', true)
            .attr('x1', xMargin - 5) // length of tick
            .attr('y1', d => d.scaledValue)
            .attr('x2', xMargin)
            .attr('y2', d => d.scaledValue)
        
        ticks.transition(this.transition)
            .attr('x1', xMargin - 5) // length of tick
            .attr('y1', d => d.scaledValue)
            .attr('x2', xMargin)
            .attr('y2', d => d.scaledValue)

        
        // ---------------------------------- TICK LABELS -----------------------------------------
    
        const tickLabels = this.svg.selectAll('text.y-tick-label').data(tickValues);
        tickLabels.enter().append('text')
            .classed('y-tick-label', true)
            .attr('x', 0) 
            .attr('y',  d => d.scaledValue)
            .text(d => this.formatValue(d.value))
            .style('fill', this.settings.waterfallSettings.fontColor)
        
        tickLabels.transition(this.transition)
            .attr('x', 0) 
            .attr('y',  d => d.scaledValue)
            .text(d => this.formatValue(d.value))
            .style('fill', this.settings.waterfallSettings.fontColor)
    

        // ---------------------------------- GRIDLINES -----------------------------------------

        const gridlines = this.svg.selectAll('line.gridline').data(tickValues);
        gridlines.enter().append('line')
            .classed('gridline', true)
            .attr('x1', xMargin) // length of tick
            .attr('y1', d => d.scaledValue)
            .attr('x2', this.scaleX.range()[1])
            .attr('y2', d => d.scaledValue)
        
        gridlines.transition(this.transition)
            .attr('x1', xMargin) // length of tick
            .attr('y1', d => d.scaledValue)
            .attr('x2', this.scaleX.range()[1])
            .attr('y2', d => d.scaledValue)

        gridlines.exit().remove();
        yAxis.exit().remove();
        ticks.exit().remove();
        tickLabels.exit().remove();
        
    }
  

    private drawBars(barArray){
    
        const bars = this.svg.selectAll('rect.bar').data(this.data.items);
        const barWidth = this.settings.waterfallSettings.barWidth

        bars.enter().append('rect')
            .classed('bar', true)
            .attr('ix', (d, i) => i)
            .attr('x', d => this.scaleX(d.category)-barWidth/2)
            .attr('y', (d, i) => barArray[i].startY)
            .attr('width', barWidth)
            .attr('height', (d, i) => barArray[i].value )
            .style('fill', d => {
                if (this.settings.waterfallSettings.gradientEnabled) {
                    const gradientType = d.type < 0 ? 'neg' : (d.type === 2 ? 'sum' : 'pos');
                    return `url(#${gradientType}-gradient)`;
                }
                else {
                    return d.color
                }
            })

        bars.transition(this.transition)
        .attr('ix', (d, i) => i)
            .attr('x', d => this.scaleX(d.category)-barWidth/2)
            .attr('y', (d, i) => barArray[i].startY)
            .attr('width', barWidth)
            .attr('height', (d, i) => barArray[i].value )
            .style('fill', d => {
                if (this.settings.waterfallSettings.gradientEnabled) {
                    const gradientType = d.type < 0 ? 'neg' : (d.type === 2 ? 'sum' : 'pos');
                    return `url(#${gradientType}-gradient)`;
                }
                else {
                    return d.color
                }
            })

        bars.exit().remove();

    }

    private drawConnectors(barArray) {
        const connectors = this.svg.selectAll('line.connectors').data(this.data.items);

        const barWidth =  this.settings.waterfallSettings.barWidth
        const connectorWidth = this.settings.waterfallSettings.connectorWidth
    
        connectors.enter().append('line')
            .classed('connectors', true)
            .attr('x1', (d, i) => this.scaleX(d.category) - barWidth / 2 )
            .attr('y1', (d, i) => barArray[i].dir === 1 ? barArray[i].startY+ connectorWidth/2 : barArray[i].startY + barArray[i].value + connectorWidth/2)
            .attr('x2', (d, i) => 
                            i < (barArray.length - 1)
                                ? this.scaleX(this.data.items[i+1].category)+barWidth/2 
                                : this.scaleX(d.category) - barWidth / 2)
            .attr('y2', (d, i) => barArray[i].dir === 1 ? barArray[i].startY+ connectorWidth/2 : barArray[i].startY + barArray[i].value + connectorWidth/2)

        connectors.transition(this.transition)
        .attr('x1', (d, i) => this.scaleX(d.category) - barWidth / 2 )
        .attr('y1', (d, i) => barArray[i].dir === 1 ? barArray[i].startY+ connectorWidth/2 : barArray[i].startY + barArray[i].value + connectorWidth/2)
        .attr('x2', (d, i) => 
                        i < (barArray.length - 1)
                            ? this.scaleX(this.data.items[i+1].category)+barWidth/2 
                            : this.scaleX(d.category) - barWidth / 2)
        .attr('y2', (d, i) => barArray[i].dir === 1 ? barArray[i].startY+ connectorWidth/2 : barArray[i].startY + barArray[i].value + connectorWidth/2)

        connectors.exit().remove();        
    }

    private drawDataLabel(barArray) {
        const dataLabel = this.svg.selectAll('text.data-label').data(this.data.items)

        const margin = this.settings.waterfallSettings.dataFontSize/2

        dataLabel.enter().append('text')
            .classed('data-label', true)
            .attr('x', d => this.scaleX(d.category))
            .attr('y', (d,i) => {
                let yPos = 0
                barArray[i].dir === 1 || d.type === 2 ? yPos = barArray[i].startY - margin : yPos = barArray[i].startY + barArray[i].value + margin*3
                return yPos
            })
            .text(d => {
                if (this.settings.waterfallSettings.dataLabel) {
                    return this.formatValue(d.value)
                }
            })
            .style('fill', this.settings.waterfallSettings.dataFontColor)

        dataLabel.transition(this.transition)
            .attr('x', d => this.scaleX(d.category))
            .attr('y', (d,i) => {
                let yPos = 0
                barArray[i].dir === 1 || d.type === 2 ? yPos = barArray[i].startY - margin : yPos = barArray[i].startY + barArray[i].value + margin*3
                return yPos
            })
            .text(d => {
                if (this.settings.waterfallSettings.dataLabel) {
                    return this.formatValue(d.value)
                }
            })
            .style('fill', this.settings.waterfallSettings.dataFontColor)

        dataLabel.exit().remove();     
    }

    private drawCategoryLabels(){

        const catLabels = this.svg.selectAll('text.category-label').data(this.data.items)
        
        catLabels.enter().append('text')
            .classed('category-label', true)
            .attr('ix', (d,i) => i)
            .attr('x', d => this.scaleX(d.category))
<<<<<<< Updated upstream
            .attr('y', (d, i) => {
                return this.dim[1]*0.98                             // ---------------------------------------------------- HÅRDKODAT FÖRBÄTTRA ---------------------------------------------------

            })
            .text(d => d.category)
            .style('fill', this.settings.waterfallSettings.fontColor)
=======
            .attr('y', this.dim[1]*0.98)                           // ---------------------------------------------------- HÅRDKODAT FÖRBÄTTRA ---------------------------------------------------
            .style('fill', this.settings.waterfallSettings.fontColor)
            .each((d, i, nodes) => {
                const textElement = select(nodes[i]);
                if (this.getTextWidth(d.category) > maxWidth) {
                    let lines = this.breakLine(d.category, maxWidth);
                    lines.forEach((line, lineIndex) => {
                        textElement.append('tspan')
                            .attr('x', this.scaleX(d.category))
                            .attr('dy', lineIndex ? '1.2em' : 0)
                            .text(line);
                    });
                } else {
                    textElement.text(d.category);
                }
            });
>>>>>>> Stashed changes

        catLabels.transition(this.transition)
            .attr('ix', (d,i) => i)
            .attr('x', d => this.scaleX(d.category))
            .attr('y', this.dim[1]*0.98)                           // ---------------------------------------------------- HÅRDKODAT FÖRBÄTTRA ---------------------------------------------------
            .style('fill', this.settings.waterfallSettings.fontColor)
            .each((d, i, nodes) => {
                const textElement = select(nodes[i]);
                if (this.getTextWidth(d.category) > maxWidth) {
                    let lines = this.breakLine(d.category, maxWidth);
                    lines.forEach((line, lineIndex) => {
                        textElement.append('tspan')
                            .attr('x', this.scaleX(d.category))
                            .attr('dy', lineIndex ? '1.2em' : 0)
                            .text(line);
                    });
                } else {
                    textElement.text(d.category);
                }
            });
            
        catLabels.exit().remove();
        return catLabels        
    }

    private defGradients(colors) {
        const types = ['pos', 'neg', 'sum'];
    
        types.forEach((type, index) => {
            const gradientId = `${type}-gradient`;
            const barColor = colors[index];
            const lighterColor = this.lightenColor(barColor, 25);
    
            let gradient = this.svg.select(`#${gradientId}`);
            if (gradient.empty()) {
                gradient = this.svg.append("defs")
                    .append("linearGradient")
                    .attr("id", gradientId)
                    .attr("x1", "0%") 
                    .attr("y1", "0%")
                    .attr("x2", "100%") 
                    .attr("y2", "100%");
    
                gradient.append("stop").attr("offset", "30%").attr("stop-color", barColor);
                gradient.append("stop").attr("offset", "100%").attr("stop-color", lighterColor);
            }
        })
        
    }

    private padHex(str: string): string {
        return str.length === 1 ? '0' + str : str;
    }

    private lightenColor(hex, percent) {
        percent = Math.min(100, Math.max(0, percent));
    
        let r = parseInt(hex.substring(1, 3), 16);
        let g = parseInt(hex.substring(3, 5), 16);
        let b = parseInt(hex.substring(5, 7), 16);
    
        let adjust = (percent / 100) * 255;
    
        r = Math.min(255, r + adjust);
        g = Math.min(255, g + adjust);
        b = Math.min(255, b + adjust);
    
        return "#" + 
        this.padHex(Math.round(r).toString(16)) +
        this.padHex(Math.round(g).toString(16)) +

        this.padHex(Math.round(b).toString(16));
    }

    private formatMeasure(measure: Number, fs: string): string { // :string definerar att det vi returnerar är en sträng
        const formatter = valueFormatter.create({format: fs})
        return formatter.format(measure)
    }

    private getTextWidth(txt: string): number {
        const textProperties = {
            text: txt,
            fontFamily: this.settings.waterfallSettings.fontFamily,
            fontSize: `${this.settings.waterfallSettings.fontSize}pt`
        }
        return measureSvgTextWidth(textProperties)
    }

    private formatValue(num) {
        let rounded;

        (num >= 1000000) 
            ? rounded = (num/1000000).toFixed(this.settings.waterfallSettings.decimals) + 'M'
            : num >= 1000 
                ? rounded = (num/1000).toFixed(this.settings.waterfallSettings.decimals) + 'k'
                : rounded = num

        return rounded.toString();
    }

    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {

        // här sätts ordningen i hur det displayas i powerbi

        const objectName: string = options.objectName
        const objectEnumeration: VisualObjectInstance[] = []

        switch(objectName) {
            case 'waterfallSettings': 
                objectEnumeration.push ({
                    objectName,
                    properties: {
                        posBarColor: this.settings.waterfallSettings.posBarColor
                    },
                    selector: null
                }),
                objectEnumeration.push ({
                    objectName,
                    properties: {
                        negBarColor: this.settings.waterfallSettings.negBarColor
                    },
                    selector: null
                }),
                objectEnumeration.push ({
                    objectName,
                    properties: {
                        sumBarColor: this.settings.waterfallSettings.sumBarColor
                    },
                    selector: null
                }),
                /*objectEnumeration.push ({    //   -------------------------------- update if FX color needed
                    objectName,
                    properties: {
                        sumBarColor: this.settings.waterfallSettings.sumBarColor
                        //negBarColor: this.settings.waterfallSettings.negBarColor
                    },
                    selector: dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals),
                    altConstantValueSelector: this.settings.waterfallSettings.sumBarColor,  
                    propertyInstanceKind: { // Detta är vad som blir "fx knappen" conditional formatting 
                        sumBarColor: VisualEnumerationInstanceKinds.ConstantOrRule  /// Här defineras det om färgen ska vara solid eller enligt field view. Gradient fungerar inte 
                    }
                }),*/
                objectEnumeration.push ({
                    objectName,
                    properties: {
                        gradientEnabled: this.settings.waterfallSettings.gradientEnabled,
                        barWidth: this.settings.waterfallSettings.barWidth,
                        lineWidth: this.settings.waterfallSettings.lineWidth,
                        fontSize: this.settings.waterfallSettings.fontSize,
                        fontFamily: this.settings.waterfallSettings.fontFamily,
                        fontColor: this.settings.waterfallSettings.fontColor,
                        connectorWidth: this.settings.waterfallSettings.connectorWidth,
                        lineColor: this.settings.waterfallSettings.lineColor,
                        dataLabel: this.settings.waterfallSettings.dataLabel,
                        decimals: this.settings.waterfallSettings.decimals,
                        dataFontSize: this.settings.waterfallSettings.dataFontSize,
                        dataFontFamily: this.settings.waterfallSettings.dataFontFamily,
                        dataFontColor: this.settings.waterfallSettings.dataFontColor,
                        hideStart: this.settings.waterfallSettings.hideStart,
                        gridlineColor: this.settings.waterfallSettings.gridlineColor,
                        gridlineWidth: this.settings.waterfallSettings.gridlineWidth
                    },
                    selector: null
                })
                break
        }

        return objectEnumeration;
    }
}