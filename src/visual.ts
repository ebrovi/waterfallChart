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
        this.data = transformData(options, this.settings.waterfallSettings.barColor)
        console.log("this.data", this.data)
        

        setStyle(this.settings)
        this.dim = [options.viewport.width, options.viewport.height]
        this.svg.attr('width', this.dim[0])   
        this.svg.attr('height', this.dim[1])

        this.scaleX = scalePoint()
        .domain(Array.from(this.data.items, d => d.category))
        .range([0, this.dim[0]-this.settings.waterfallSettings.fontSize/2])
        .padding(0.5)
    
        console.log("min max", this.data.minValue, this.data.maxValue)
        
        this.scaleY = scaleLinear()
        .domain([this.data.minValue, this.data.maxValue])
        .range([this.dim[1], 0])

        console.log("0", this.scaleY(0))
        console.log("scaled min max", this.scaleY(this.data.minValue), this.scaleY(this.data.maxValue))
        console.log(this.dim[1])

        this.transition = transition().duration(500).ease(easeLinear)

        const baseLine = this.dim[1] -this.settings.waterfallSettings.fontSize*2 -this.settings.waterfallSettings.lineWidth/2   // ----------------------- FÖRBÄTTRA -----------------------------------
        
        let prevHeight = baseLine ;
        let barLength: number[] = [];
        for (let i = 0; i < this.data.items.length; i++) { //       ------------------------- height calculations need to be redone to not give negative barLength. abs value? need to know if negative value as this gives direction.
            let d = this.data.items[i];
            if (d.type === 1) {
                prevHeight -= this.scaleY(d.value);
            }
            barLength.push(prevHeight);
        }
        
        this.drawXAxis(baseLine)
        this.drawCategoryLabels()
        //this.drawBars(barLength)
        
       this.drawBars2()
        //this.darwBars3(baseLine)
        this.drawConnectors(barLength)

    }

    private static parseSettings(dataView: DataView): VisualSettings {
        return <VisualSettings>VisualSettings.parse(dataView);
    }


    private drawXAxis(baseline: number) {
        let xAxisLine = this.svg.select('line.x-axis');
        if (xAxisLine.empty()) {
            xAxisLine = this.svg.append('line').classed('x-axis', true);
        }
    
        xAxisLine
            .attr('x1', 0)
            .attr('y1', baseline)
            .attr('x2', this.scaleX.range()[1])
            .attr('y2', baseline);
    
        if (this.transition) {
            xAxisLine.transition(this.transition);
        } 
    }

    private drawBars2(){
        let prevH = this.scaleY(0);

        interface barObject {
            startY: number,
            dir: number,
            type: number;
            value: number
        }

        let cumulative = 0 

        let barArray: barObject[] = []; 

        /*or (let i = 0; i < this.data.items.length; i++) {
            
            let currentValue = this.data.items[i].value;
            let startY = this.scaleY(cumulative)
            let height = this.scaleY(Math.abs(currentValue));
            
            if (this.data.items[i].type === 1) {
                console.log("before", this.data.items[i].category,"prevH", prevH, "cumulative", cumulative, "startY", startY)
                if (currentValue < 0) {
                    startY = prevH;
                }
                else {
                    startY = prevH - height
                }
                barArray.push({
                    startY: <number> startY,
                    dir: <number> currentValue < 0 ? -1 : 1,
                    type: <number> this.data.items[i].type,
                    value: <number> height
                })
                
                prevH = startY + (currentValue < 0 ? height : -height);
                cumulative += currentValue;
                console.log("after", this.data.items[i].category,"prevH", prevH, "cumulative", cumulative, "startY", startY)
                
            }
            else {
                let partSumStart = currentValue < 0 ? this.scaleY(0) : this.scaleY(cumulative)
                let partSumHeight = this.scaleY(Math.abs(currentValue));
                barArray.push({
                    startY: <number> partSumStart,
                    dir: <number> currentValue < 0 ? -1 : 1,
                    type: <number> this.data.items[i].type,
                    value: <number> partSumHeight
                })
            }
        }*/
        let lastType1EndPosition = this.scaleY(0);
        console.log()

        for (let i = 0; i < this.data.items.length; i++) {
            const currentItem = this.data.items[i];
            let height = this.scaleY(0)-this.scaleY(Math.abs(currentItem.value));
            console.log("value", currentItem.value,"height", height)
        
            if (currentItem.type === 1) {
                let startY;
        
                if (currentItem.value < 0) {
                    startY = prevH;
                    prevH += height;
                } else {
                    startY = prevH - height;
                    prevH -= height;
                }
        
                cumulative += currentItem.value;
                lastType1EndPosition = prevH; // Update last type 1 bar end position
        
                barArray.push({
                    startY: startY,
                    dir: currentItem.value < 0 ? -1 : 1,
                    type: currentItem.type,
                    value: height
                });
        
            } else if (currentItem.type === 2) {
                // For type 2 bars, calculate startY and height but do not update prevH or cumulative
                let startY = currentItem.value - this.data.items[i-1].value < 0 ? this.scaleY(0) : this.scaleY(cumulative);
                let partSumHeight = this.scaleY(0)-this.scaleY(Math.abs(currentItem.value));
        
                barArray.push({
                    startY: startY,
                    dir: currentItem.value < 0 ? -1 : 1,
                    type: currentItem.type,
                    value: partSumHeight
                });
            }
        }

        console.log("dim1", this.dim[1])
        console.log("barArray",barArray)

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
                    const gradientId = `gradientColor${d.category.replace(/[^a-zA-Z0-9]/g, '')}`; // Generate a unique gradient id based on the category
                    this.applyGradient(gradientId, this.settings.waterfallSettings.barColor); // Pass the unique gradient id and color
                    return `url(#${gradientId})`;
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
                    const gradientId = `gradientColor${d.category.replace(/[^a-zA-Z0-9]/g, '')}`; // Generate a unique gradient id based on the category
                    this.applyGradient(gradientId, this.settings.waterfallSettings.barColor); // Pass the unique gradient id and color
                    return `url(#${gradientId})`;
                }
                else {
                    return d.color
                }
            })

            bars.exit().remove();

    }

    private drawBars(barLength: number[]) { // barLength blir från svgs 0 hörn så det blir den "nedre" delen visuellt 
        const bars = this.svg.selectAll('rect.bar').data(this.data.items);
        const barWidth = this.settings.waterfallSettings.barWidth
        console.log("barLength",barLength)
        bars.enter().append('rect')
            .classed('bar', true)
            .attr('ix', (d, i) => i)
            .attr('x', d => this.scaleX(d.category)-barWidth/2)
            .attr('y', (d, i) => barLength[i])
            .attr('width', barWidth)
            .attr('height', (d, i) => Math.abs(barLength[i]))
            .style('fill', d => {
                if (this.settings.waterfallSettings.gradientEnabled) {
                    const gradientId = `gradientColor${d.category.replace(/[^a-zA-Z0-9]/g, '')}`; // Generate a unique gradient id based on the category
                    this.applyGradient(gradientId, this.settings.waterfallSettings.barColor); // Pass the unique gradient id and color
                    return `url(#${gradientId})`;
                }
                else {
                    return d.color
                }
            })
        
    
        /*bars.transition(this.transition)
            .attr('ix', (d, i) => i)
            .attr('x', d => this.scaleX(d.category)-barWidth/2)
            .attr('y', (d, i) => barLength[i])
            .attr('width', barWidth)
            .attr('height', (d, i) => 
                                i > 0 
                                    ? d.type === 1
                                        ? barLength[i - 1] - barLength[i] 
                                        : this.dim[1]-barLength[i]-this.settings.waterfallSettings.fontSize*2- this.settings.waterfallSettings.lineWidth
                                    : this.scaleY(d.value)- this.settings.waterfallSettings.lineWidth/2) 
            .style('fill', d => {
                if (this.settings.waterfallSettings.gradientEnabled) {
                    const gradientId = `gradientColor${d.category.replace(/[^a-zA-Z0-9]/g, '')}`; // Generate a unique gradient id based on the category
                    this.applyGradient(gradientId, this.settings.waterfallSettings.barColor); // Pass the unique gradient id and color
                    return `url(#${gradientId})`;
                }
                else {
                    return d.color
                }
            })
        
        bars.exit().remove();*/
    }

    private drawConnectors(barLength: number[]) {
        
        const connectors = this.svg.selectAll('line.connectors').data(this.data.items);

        const barWidth =  this.settings.waterfallSettings.barWidth
        const connectorWidth = this.settings.waterfallSettings.connectorWidth
    
        connectors.enter().append('line')
            .classed('connectors', true)
            .attr('x1', (d, i) => this.scaleX(d.category) + barWidth / 2 )
            .attr('y1', (d, i) => barLength[i]+ connectorWidth/2)
            .attr('x2', (d, i) => 
                            i < (barLength.length - 1)
                                ? this.scaleX(this.data.items[i+1].category)-barWidth / 2
                                : this.scaleX(d.category) + barWidth / 2)
            .attr('y2', (d, i) => barLength[i]+ connectorWidth/2);

        connectors.transition(this.transition)
            .attr('x1', (d, i) => this.scaleX(d.category) + barWidth / 2)
            .attr('y1', (d, i) => barLength[i]+ connectorWidth/2)
            .attr('x2', (d, i) => 
                            i < (barLength.length - 1)
                                ? this.scaleX(this.data.items[i+1].category)-barWidth / 2
                                : this.scaleX(d.category) + barWidth / 2)
            .attr('y2', (d, i) => barLength[i]+ connectorWidth/2);

        connectors.exit().remove();        
    }

    private drawCategoryLabels(){

        const catLabels = this.svg.selectAll('text.category-label').data(this.data.items)
        
        catLabels.enter().append('text')
            .classed('category-label', true)
            .attr('ix', (d,i) => i)
            .attr('x', d => this.scaleX(d.category))
            .attr('y', (d, i) => {
                return this.dim[1]*0.98                             // ---------------------------------------------------- HÅRDKODAT FÖRBÄTTRA ---------------------------------------------------

            })
            .text(d => d.category)
            .style('fill', this.settings.waterfallSettings.fontColor)

        catLabels.transition(this.transition)
            .attr('ix', (d,i) => i)
            .attr('x', d => this.scaleX(d.category))
            .attr('y', (d, i) => {
                return this.dim[1]*0.98
            })
            .text(d => d.category)
            .style('fill', this.settings.waterfallSettings.fontColor)

        catLabels.exit().remove();
        return catLabels        
    }

    private applyGradient(gradientId: string, barColor: string) {
        let gradient = this.svg.select(`#${gradientId}`);
    
        if (gradient.empty()) {
            gradient = this.svg.append("defs")
                .append("linearGradient")
                .attr("id", gradientId);
        }
    
        gradient.attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "100%");
    
        let stop1 = gradient.select("stop:first-child");
        let stop2 = gradient.select("stop:last-child");
    
        if (stop1.empty()) {
            stop1 = gradient.append("stop").attr("offset", "30%");
        }
    
        if (stop2.empty()) {
            stop2 = gradient.append("stop").attr("offset", "100%");
        }
    
        stop1.attr("stop-color", barColor)
             .attr("stop-opacity", 1);
    
        stop2.attr("stop-color", '#D5D2D2')
             .attr("stop-opacity", 1);
    }

    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {

        const objectName: string = options.objectName
        const objectEnumeration: VisualObjectInstance[] = []

        switch(objectName) {
            case 'waterfallSettings': 
                objectEnumeration.push ({
                    objectName,
                    properties: {
                        defaultColor: this.settings.waterfallSettings.defaultColor
                    },
                    selector: null
                }),
                objectEnumeration.push ({
                    objectName,
                    properties: {
                        barColor: this.settings.waterfallSettings.barColor
                    },
                    selector: dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals),
                    altConstantValueSelector: this.settings.waterfallSettings.barColor,  
                    propertyInstanceKind: { // Detta är vad som blir "fx knappen" conditional formatting 
                        dataPointColor: VisualEnumerationInstanceKinds.ConstantOrRule  /// Här defineras det om färgen ska vara solid eller enligt field view. Gradient fungerar inte 
                    }
                }),
                objectEnumeration.push ({
                    objectName,
                    properties: {
                        lineWidth: this.settings.waterfallSettings.lineWidth,
                        fontSize: this.settings.waterfallSettings.fontSize,
                        fontFamily: this.settings.waterfallSettings.fontFamily,
                        fontColor: this.settings.waterfallSettings.fontColor,
                        connectorWidth: this.settings.waterfallSettings.connectorWidth,
                        gradientEnabled: this.settings.waterfallSettings.gradientEnabled
                    },
                    selector: null
                })
                break
        }

        return objectEnumeration;
    }
}