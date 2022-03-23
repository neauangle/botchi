/*
Copyright (C) 2022 https://github.com/neauangle (neauangle@protonmail.com)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import * as Util from './util.js';
import * as ResizeHandler from './resize-handler.js';
import * as _ from './third_party/lightweight-charts.standalone.development.js';
import * as Emitter from  './event-emitter.js'; const emitter = Emitter.instance(); export {emitter};

export const EVENTS = {
    BAR_DURATION_CHANGED: "BAR_DURATION_CHANGED",
}

export const LineStyle = LightweightCharts.LineStyle;


const chartContainer = document.getElementById('chart-container');
const chartTitle = document.getElementById('chart-title');

const priceAxisPercentButton = document.getElementById("chart-price-axis-percent-button");
const priceAxisNormalButton = document.getElementById("chart-price-axis-amount-button");

let barDuration;
const durationToButton = {
    '1m': document.getElementById("chart-1m-bars-button"),
    '15m':  document.getElementById("chart-15m-bars-button"),
    '1h':  document.getElementById("chart-1h-bars-button"),
    '4h':  document.getElementById("chart-4h-bars-button"),
    '1d':  document.getElementById("chart-1d-bars-button"),

};

let chartContainerSize = chartContainer.getBoundingClientRect();
let hasBars = false;

const chartConfig = {
    //I don't know why you need the -100 here, maybe just a timing thing (you dont when updating size)
    width: chartContainerSize.width - 100, 
    height: chartContainerSize.height,
    layout: {
        background: {type: LightweightCharts.ColorType.Solid},
        textColor: Util.getCSSVariable('--text-colour-a').trim(),
        fontSize: 12,
        fontFamily: 'Calibri',
    },
    grid: {
        vertLines: {style: 1, visible: true},
        horzLines: {visible: true},
    }, 
    rightPriceScale: {},
    timeScale: {timeVisible: true, minBarSpacing: 5},
    crosshair: {mode: LightweightCharts.CrosshairMode.Normal},
}
const chart = LightweightCharts.createChart(chartContainer, chartConfig);

const candleSeries = chart.addCandlestickSeries({
    wickVisible: true,
    borderVisible: false,
    priceScaleId: 'right'
});

export function setColours({upColour, downColour, gridlineColour, backgroundColour, textColour}){
    candleSeries.applyOptions({
        upColor: upColour,
        downColor: downColour,
        wickUpColor: upColour,
        wickDownColor: downColour
    });
    chart.applyOptions({
        grid: {
            vertLines: {color: gridlineColour},
            horzLines: {color: gridlineColour},
        }, 
        layout: {
            background: {color: backgroundColour},
            textColor: textColour,
        },
        rightPriceScale: {borderColor: gridlineColour},
        timeScale: {borderColor: gridlineColour},
    });
}
setColours({
    upColour: Util.getCSSVariable('--buy-colour').trim(),
    downColour: Util.getCSSVariable('--sell-colour').trim(),
    gridlineColour: Util.getCSSVariable('--line-colour-a-three-quarters'),
    backgroundColour: Util.getCSSVariable('--background-colour-a'),
    textColour:  Util.getCSSVariable('--text-colour-a').trim()
});




export function getChart(){
    return chart;
}

export function getSeries(){
    return candleSeries;
}


window.addEventListener('resize', async () => {
    updateChartSize()
});
ResizeHandler.emitter.addEventListener(ResizeHandler.EVENT.PROPORTION_UPDATED, ev => {
    updateChartSize();
});
export function updateChartSize(){
    chartContainerSize = chartContainer.getBoundingClientRect();
    chart.applyOptions({
        width: chartContainerSize.width, 
        height: chartContainerSize.height,
    });
    chart.timeScale().fitContent();
}


export function hasData(){
    return hasBars;
}

export function update(bars, addedNewBar){
    if (hasBars){
        if (bars.length){
            candleSeries.update(bars[bars.length-1]);
            if (bars.length < 10 && addedNewBar){
                chart.timeScale().fitContent();
            }  
        } 
    } else {
        candleSeries.setData(bars);
        hasBars = true;
        chart.timeScale().fitContent();
    }
    
}

export function setPrecision(numDecimals){
    let precision = numDecimals;
    let minMove = 10**(-(precision-1));
    candleSeries.applyOptions({
        priceFormat: {
            type: 'price',
            precision,
            minMove,
        },
    })

}

export async function initChart(title, bars){
    chartTitle.innerText = title;
    if (bars && bars.length){
        hasBars = true;
        candleSeries.setData(bars);
        chart.timeScale().fitContent();
        
    } else { 
        hasBars = false;
        candleSeries.setData([]);
    }

    chart.applyOptions({
        rightPriceScale: {
			autoScale: true,
        },
        overlayPriceScales: {
			autoScale: true,
        }
    });
    //doing this makes the axis recalculate the padding required on the right
    //Unlike in setPriceScaleMode, I'm pretty sure this is desired every time.
    await Util.wait(1);
    updateChartSize();
}



async function setPriceScaleMode(mode, __firstTime=true){
    if (mode === LightweightCharts.PriceScaleMode.Normal){
        priceAxisPercentButton.classList.remove('selected');
        priceAxisNormalButton.classList.add('selected');
    } else {
        priceAxisPercentButton.classList.add('selected');
        priceAxisNormalButton.classList.remove('selected');
    }
    chart.applyOptions({
        rightPriceScale: {mode},
        overlayPriceScales: {mode}
    });
   /*  console.log('candleSeries', candleSeries.priceScale('right').options())
    for (const series of secondarySeries){
        console.log('series', series.priceScale('right').options());
    } */
    //doing this makes the axis recalculate the padding required on the right
    //but I'm not sure if we WANT that actually- maybe rather the chart NOT resize
    //As it is, user can press % sign again and the chart will repad the axis.
    if (__firstTime && false){
        await Util.wait(5);
        setPriceScaleMode(mode, false);
    }
}

priceAxisNormalButton.addEventListener('click', e => setPriceScaleMode(LightweightCharts.PriceScaleMode.Normal));
priceAxisPercentButton.addEventListener('click', e => setPriceScaleMode(LightweightCharts.PriceScaleMode.Percentage));

let secondarySeries = [];
export function addSecondaryLineSeries(options){
    const series = chart.addLineSeries(options/* {
        //Interface: SeriesOptionsCommon
        title: options.title,
        visible: options.visible,
        priceLineVisible: options.priceLineVisible,
        lastValueVisible: options.lastValueVisible,
        priceScaleId: options.priceScaleId,
        priceLineSource: options.priceLineSource,
        priceLineWidth: options.priceLineWidth,
        priceLineColor: options.priceLineColor,
        priceLineStyle: options.priceLineStyle,
        priceFormat: options.priceFormat,
        baseLineVisible: options.baseLineVisible,
        baseLineColor: options.baseLineColor,
        baseLineWidth: options.baseLineWidth,
        baseLineStyle: options.baseLineStyle,
        autoscaleInfoProvider: options.autoscaleInfoProvider,
        scaleMargins: options.scaleMargins,

        //Interface: LineStyleOptions
        color: options.color,
        lineStyle: options.lineStyle,
        lineWidth: options.lineWidth,
        lineType: options.lineType,
        crosshairMarkerVisible: options.crosshairMarkerVisible,
        crosshairMarkerRadius: options.crosshairMarkerRadius,
        crosshairMarkerBorderColor: options.crosshairMarkerBorderColor,
        crosshairMarkerBackgroundColor: options.crosshairMarkerBackgroundColor,
        lastPriceAnimation: options.lastPriceAnimation
    } */);
    secondarySeries.push(series);
    return series;
}
export function removeSecondarySeries(series){
    Util.removeArrayItemOnce(secondarySeries, series);
    const ret = chart.removeSeries(series);
    return ret;
}

let priceLines = [];
export function addPriceLine(options){
    priceLines.push(candleSeries.createPriceLine(options));
    return priceLines[priceLines.length-1];
}
export function removePriceLine(line){
    Util.removeArrayItemOnce(priceLines, line);
    return candleSeries.removePriceLine(line);
}

export function getBarDuration(){
    return barDuration;
}

export function setBarDuration(duration){
    if ( durationToButton[barDuration]){
        durationToButton[barDuration].classList.remove('selected');
    }
    durationToButton[duration].classList.add('selected');
    barDuration = duration;
    emitter.emitEvent(EVENTS.BAR_DURATION_CHANGED, {duration: duration});
}

for (const buttonDuration of Object.keys(durationToButton)){
    durationToButton[buttonDuration].addEventListener('click', e => setBarDuration(buttonDuration));
}

setBarDuration('1m');
setPriceScaleMode(LightweightCharts.PriceScaleMode.Normal);
setPrecision(9);
(async () => {
    await Util.wait(250);
    updateChartSize();
})();

