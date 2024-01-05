/*
 *  Power BI Visualizations
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

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class VisualSettings extends DataViewObjectsParser {
      public waterfallSettings: waterfallSettings = new waterfallSettings();
      }

    export class waterfallSettings {
      public defaultColor: string = "#99999"
      public posBarColor: string = "#00782E";
      public negBarColor: string = "#B10606";
      public sumBarColor: string = "#003339";
      public fontSize: number = 10;
      public fontFamily: string = "Arial, sans-serif"
      public fontColor: string = "#D5D2D2"
      public lineWidth: number = 1;
      public barWidth: number = 40;
      public connectorWidth: number = 1;
      public gradientEnabled: boolean = false;
      public lineColor: string = "#D5D2D2"
      public dataLabel: boolean = false;
      public hideStart: boolean = false;
      public dataFontSize: number = 12;
      public dataFontFamily: string = "Arial, sans-serif"
      public dataFontColor: string = "#433F72"
      public gridlineColor: string = "#333333";
      public gridlineWidth: number = 0.5;
      public decimals: number = 2;
      public displayUnit: string = "None"
     }

