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
        this.data = transformData(options)
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
        .domain([0,this.data.total]) // Your data's extent
        .range([0-10,this.dim[1]]); // The SVG height //                            -------------- HÅRDKODAT 0-10 ------------- FÖRBÄTTRA -------------- 
       

        this.transition = transition().duration(500).ease(easeLinear)

        const baseLine = this.dim[1] -this.settings.waterfallSettings.fontSize*2     // ----------------------- FÖRBÄTTRA -----------------------------------
        
        let prevHeight = baseLine;
        let heights: number[] = [];
        for (let i = 0; i < this.data.items.length; i++) {
            let d = this.data.items[i];
            if (d.type === 1) {
                prevHeight -= this.scaleY(d.value);
            }
            heights.push(prevHeight);
        }
        console.log("heights", heights)
        
        this.drawAxes(baseLine)
        this.drawCategoryLabels()
        this.drawBars(heights)
        this.drawConnectors(heights)
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

    private drawBars(heights: number[]) {
        const bars = this.svg.selectAll('rect.bar').data(this.data.items);
        const barWidth = 40
    
        bars.enter().append('rect')
            .classed('bar', true)
            .attr('ix', (d, i) => i)
            .attr('x', d => this.scaleX(d.category)-barWidth/2)
            .attr('y', (d, i) => heights[i])
            .attr('width', barWidth)
            .attr('height', (d, i) => 
                                i > 0 
                                    ? d.type === 1
                                        ? heights[i - 1] - heights[i] 
                                        : this.dim[1]-heights[i]-this.settings.waterfallSettings.fontSize*2 
                                    : this.scaleY(d.value)); 
    
        bars.transition(this.transition)
            .attr('ix', (d, i) => i)
            .attr('x', d => this.scaleX(d.category)-barWidth/2)
            .attr('y', (d, i) => heights[i])
            .attr('width', barWidth)
            .attr('height', (d, i) => 
                                i > 0 
                                    ? d.type === 1
                                        ? heights[i - 1] - heights[i] 
                                        : this.dim[1]-heights[i]-this.settings.waterfallSettings.fontSize*2
                                    : this.scaleY(d.value)); 
        
        bars.exit().remove();
    }

    private drawConnectors(heights: number[]) {
        
        const connectors = this.svg.selectAll('line.connectors').data(this.data.items);

        const barWidth = 40;

        connectors.enter().append('line')
            .classed('connectors', true)
            .attr('x1', (d, i) => this.scaleX(d.category) + barWidth / 2)
            .attr('y1', (d, i) => heights[i])
            .attr('x2', (d, i) => 
                            i < (heights.length - 1)
                                ? this.scaleX(this.data.items[i+1].category)-barWidth / 2
                                : this.scaleX(d.category) + barWidth / 2)
            .attr('y2', (d, i) => heights[i]);

        connectors.transition(this.transition)
            .attr('x1', (d, i) => this.scaleX(d.category) + barWidth / 2)
            .attr('y1', (d, i) => heights[i])
            .attr('x2', (d, i) => 
                            i < (heights.length - 1)
                                ? this.scaleX(this.data.items[i+1].category)-barWidth / 2
                                : this.scaleX(d.category) + barWidth / 2)
            .attr('y2', (d, i) => heights[i]);

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

    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
    }
}