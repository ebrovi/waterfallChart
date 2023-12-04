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
    
        this.scaleY = scaleLinear()
        .domain([this.data.minValue,this.data.total]) // Your data's extent // borde vara max av någon grouping och minst av ena värdet 
        .range([0-10,this.dim[1]]); // The SVG height //                            -------------- HÅRDKODAT 0-10 ------------- FÖRBÄTTRA -------------- 
       

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
        
        this.drawAxes(baseLine)
        this.drawCategoryLabels()
        //this.drawBars(barLength)
        
        this.drawBars2(baseLine)
        //this.darwBars3(baseLine)
        this.drawConnectors(barLength)



    }

    private static parseSettings(dataView: DataView): VisualSettings {
        return <VisualSettings>VisualSettings.parse(dataView);
    }


    private drawAxes(baseline: number) {
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

    private darwBars3 (baseLine: number) {
        let cumulativeValue = baseLine;

        const bars = this.svg.selectAll('rect.bar').data(this.data.items);
        const barWidth = this.settings.waterfallSettings.barWidth;

        bars.enter().append('rect')
            .classed('bar', true)
            .attr('ix', (d, i) => i)
            .attr('x', d => this.scaleX(d.category) - barWidth / 2)
            .attr('y', d => {
                let yValue = this.scaleY(cumulativeValue);
                if (d.value < 0) {
                    yValue = this.scaleY(cumulativeValue + d.value);
                }
                cumulativeValue += d.value;
                return yValue;
            })
            .attr('width', barWidth)
            .attr('height', d => this.scaleY(Math.abs(d.value)))
            .style('fill', d => {
                if (this.settings.waterfallSettings.gradientEnabled) {
                    const gradientId = `gradientColor${d.category.replace(/[^a-zA-Z0-9]/g, '')}`; // Generate a unique gradient id based on the category
                    this.applyGradient(gradientId, this.settings.waterfallSettings.barColor); // Pass the unique gradient id and color
                    return `url(#${gradientId})`;
                }
                else {
                    return d.color
                }
            });
            }

    private drawBars2(baseLine: number){
        let prevH = baseLine/2;

        interface barObject {
            startY: number,
            dir: number,
            endY: number,
            type: number;
        }

        let cumulative = 0 

        let barArray: barObject[] = []; 

        for (let i = 0; i < this.data.items.length; i++) {
            console.log("prev",prevH)
            if (this.data.items[i].type === 1) {
                if (i == 0) {
                    if (this.data.items[i].value < 0) {
                    barArray.push({
                        startY: <number> prevH,
                        dir: <number> -1,
                        endY: <number> prevH+this.scaleY(this.data.items[i].value),
                        type: this.data.items[i].type
                    })
                    prevH += this.scaleY(this.data.items[i].value)
                    }
                    else {
                        barArray.push({
                            startY: <number> this.scaleY(this.data.items[i].value),
                            dir: <number> 1,
                            endY: <number> prevH,
                            type: this.data.items[i].type
                        })
                        prevH -= this.scaleY(this.data.items[i].value)
                    }
                }
                else {
                    if (i > 0 && this.data.items[i].value > 0) {
                        barArray.push({
                            startY: <number> this.scaleY(this.data.items[i].value),
                            dir: <number> 1,
                            endY: <number> prevH,
                            type: this.data.items[i].type
                        })
                        prevH -= this.scaleY(this.data.items[i].value)
                    }
                    else {
                        barArray.push({
                            startY: <number> prevH,
                            dir: <number> -1,
                            endY: <number> this.scaleY(this.data.items[i].value),
                            type: this.data.items[i].type
                        })
                        prevH += this.scaleY(this.data.items[i].value)
                    }
                } 
            }
            else {
                if (i > 0 && this.data.items[i].value > 0) {
                    barArray.push({
                        startY: <number> this.scaleY(this.data.items[i].value),
                        dir: <number> 1,
                        endY: <number> prevH,
                        type: this.data.items[i].type
                    })
                }
                else {
                    barArray.push({
                        startY: <number> prevH,
                        dir: <number> -1,
                        endY: <number> this.scaleY(this.data.items[i].value),
                        type: this.data.items[i].type
                    })
                }
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
            .attr('height', (d, i) => Math.abs(d.value) )
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


    }

    private drawBars(barLength: number[]) { // barLength blir från svgs 0 hörn så det blir den "nedre" delen visuellt 
        const bars = this.svg.selectAll('rect.bar').data(this.data.items);
        const barWidth = this.settings.waterfallSettings.barWidth
        console.log("barLength",barLength)
        for(let i = 0; i<barLength.length; i++) {
            i>0?
            (console.log("i-1:", i-1,"height[i-1]: ", barLength[i-1]),
                console.log("i:", i, "height[i]: ", barLength[i]),
            
            console.log("diff: ", barLength[i-1]-barLength[i]))
            : console.log("i: 0", "diff: ", 0-barLength[i] )
        }
    
        bars.enter().append('rect')
            .classed('bar', true)
            .attr('ix', (d, i) => i)
            .attr('x', d => this.scaleX(d.category)-barWidth/2)
            /*.attr('y', (d, i) => 
                            barLength[i] < 0 ?
                                Math.abs(barLength[i]+barLength[i-1])
                                :barLength[i])*/
            .attr('y', (d, i) => {
                const yValue = i > 0?
                                    barLength[i] < barLength[i-1] ? 
                                                            barLength[i] + Math.abs(barLength[i] - barLength[i - 1]) 
                                                            : barLength[i] // aldrig negativ 
                                    : barLength[i]
                console.log('Bar index:', i, 'Y value:', yValue, "barLength[i]:", barLength[i], "dValue:", d.value); // This line will print the index and y value to the console
                return yValue;}) 
            /*.attr('y', (d, i) => {
                const yValue = d.value < 0?
                                    barLength[i-1] - barLength[i] < 0 ? 
                                                            barLength[i] + Math.abs(barLength[i] - barLength[i - 1]) 
                                                            : barLength[i] // aldrig negativ 
                                    : this.scaleY(d.value)
                console.log('Bar index:', i, 'Y value:', yValue, "barLength[i]:", barLength[i], "dValue:", d.value); // This line will print the index and y value to the console
                return yValue;})*/
            .attr('width', barWidth)
            .attr('height', (d, i) => 
                                i > 0 ? 
                                    (d.type === 1 ?
                                        barLength[i - 1] - barLength[i] 
                                        : this.dim[1]-barLength[i]-this.settings.waterfallSettings.fontSize*2- this.settings.waterfallSettings.lineWidth)
                                    : this.scaleY(d.value)- this.settings.waterfallSettings.lineWidth/2) 
            /*.attr('height', (d, i) => 
                                i > 0 ?
                                     d.type === 1 ? 
                                            Math.abs(barLength[i - 1] - barLength[i])
                                        : this.dim[1]-barLength[i]-this.settings.waterfallSettings.fontSize*2 - this.settings.waterfallSettings.lineWidth // 1.5 because the linewidth is both in - nej typ 2
                                    : this.scaleY(d.value)- this.settings.waterfallSettings.lineWidth/2)*/ // detta är första baren
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