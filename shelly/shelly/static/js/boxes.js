(function() {
    'use strict';

    // ---Plotly global modules
    /* global Plotly:false */

    // ---external global dependencies
    /* global d3:false */

    var boxes = window.Plotly.Boxes = {};

    var scatterMarker = Plotly.Scatter.attributes.marker;

    boxes.attributes = {
        y: {type: 'data_array'},
        y0: {type: 'any'},
        x: {type: 'data_array'},
        x0: {type: 'any'},
        whiskerwidth: {
            type: 'number',
            min: 0,
            max: 1,
            dflt: 0.5
        },
        boxpoints: {
            type: 'enumerated',
            values: ['all', 'outliers', 'suspectedoutliers', false],
            dflt: 'outliers'
        },
        boxmean: {
            type: 'enumerated',
            values: [true, 'sd', false],
            dflt: false
        },
        jitter: {
            type: 'number',
            min: 0,
            max: 1
        },
        pointpos: {
            type: 'number',
            min: -2,
            max: 2
        },
        orientation: {
            type: 'enumerated',
            values: ['v', 'h']
        },
        marker: {
            outliercolor: {
                type: 'color',
                dflt: 'rgba(0,0,0,0)'
            },
            symbol: $.extend({arrayOk: false}, scatterMarker.symbol),
            opacity: $.extend({arrayOk: false, dflt: 1}, scatterMarker.opacity),
            size: $.extend({arrayOk: false}, scatterMarker.size),
            color: $.extend({arrayOk: false}, scatterMarker.color),
            line: {
                color: $.extend({arrayOk: false}, scatterMarker.line.color),
                width: $.extend({arrayOk: false}, scatterMarker.line.width),
                outliercolor: {
                    type: 'color'
                },
                outlierwidth: {
                    type: 'number',
                    min: 0,
                    dflt: 1
                }
            }
        },
        // Inherited attributes - not used by supplyDefaults, so if there's
        // a better way to do this feel free to change.
        line: {
            color: {from: 'Scatter'},
            width: {from: 'Scatter'}
        },
        fillcolor: {from: 'Scatter'}
    };

    boxes.layoutAttributes = {
        boxmode: {
            type: 'enumerated',
            values: ['group', 'overlay'],
            dflt: 'overlay'
        },
        boxgap: {
            type: 'number',
            min: 0,
            max: 1,
            dflt: 0.3
        },
        boxgroupgap: {
            type: 'number',
            min: 0,
            max: 1,
            dflt: 0.3
        }
    };

    boxes.supplyDefaults = function(traceIn, traceOut, defaultColor) {
        function coerce(attr, dflt) {
            return Plotly.Lib.coerce(traceIn, traceOut, boxes.attributes, attr, dflt);
        }

        function coerceScatter(attr, dflt) {
            return Plotly.Lib.coerce(traceIn, traceOut, Plotly.Scatter.attributes, attr, dflt);
        }

        // In vertical (horizontal) box plots:
        // if you supply an x (y) array, you will get one box
        // per distinct x (y) value
        // if not, we make a single box and position / label it with x0 (y0)
        // (or name, if no x0 (y0) is found)
        var y = coerce('y'),
            x = coerce('x'),
            defaultOrientation;

        if (y) {
            defaultOrientation = 'v';
            if (!x) coerce('x0');
        } else if (x) {
            defaultOrientation = 'h';
            coerce('y0');
        } else {
            traceOut.visible = false;
            return;
        }

        coerce('orientation', defaultOrientation);

        // inherited from Scatter... should we mention this somehow in boxes.attributes?
        coerceScatter('line.color', (traceIn.marker||{}).color || defaultColor);
        coerceScatter('line.width', 2);
        coerceScatter('fillcolor', Plotly.Color.addOpacity(traceOut.line.color, 0.5));

        coerce('whiskerwidth');
        coerce('boxmean');
        var boxpoints = coerce('boxpoints');
        if(boxpoints) {
            coerce('jitter', boxpoints==='all' ? 0.3 : 0);
            coerce('pointpos', boxpoints==='all' ? -1.5 : 0);

            coerce('marker.symbol');
            coerce('marker.opacity');
            coerce('marker.size');
            coerce('marker.color', traceOut.line.color);
            coerce('marker.line.color');
            coerce('marker.line.width');

            if(boxpoints==='suspectedoutliers') {
                coerce('marker.outliercolor');
                coerce('marker.line.outliercolor', traceOut.marker.color);
                coerce('marker.line.outlierwidth');
            }
        }
    };

    boxes.supplyLayoutDefaults = function(layoutIn, layoutOut, fullData) {
        function coerce(attr, dflt) {
            return Plotly.Lib.coerce(layoutIn, layoutOut, boxes.layoutAttributes, attr, dflt);
        }

        var hasBoxes = fullData.some(function(trace) {
            return Plotly.Plots.isBox(trace.type);
        });

        if(!hasBoxes) return;

        coerce('boxmode');
        coerce('boxgap');
        coerce('boxgroupgap');
    };

    boxes.calc = function(gd, trace) {
        // outlier definition based on http://www.physics.csbsju.edu/stats/box2.html
        var xa = Plotly.Axes.getFromId(gd, trace.xaxis||'x'),
            ya = Plotly.Axes.getFromId(gd, trace.yaxis||'y'),
            orientation = trace.orientation,
            dstAxis, dstLetter, dst, posAxis, posLetter, pos, pos0, i;

        // Set distribution (dst) and position (pos) keys via orientation
        if (orientation==='h') {
            dstAxis = xa;
            dstLetter = 'x';
            posAxis = ya;
            posLetter = 'y';
        } else {
            dstAxis = ya;
            dstLetter = 'y';
            posAxis = xa;
            posLetter = 'x';
        }

        dst = dstAxis.makeCalcdata(trace, dstLetter);

        // In vertical (horizontal) box plots:
        // if no x (y) data, use x0 (y0), or name
        // so if you want one box
        // per trace, set x0 (y0) to the x (y) value or category for this trace
        // (or set x (y) to a constant array matching y (x))
        if (posLetter in trace) pos = posAxis.makeCalcdata(trace, posLetter);
        else {
            if (posLetter+'0' in trace) pos0 = trace[posLetter+'0'];
            else if ('name' in trace && (
                        posAxis.type==='category' ||
                        ($.isNumeric(trace.name) &&
                            ['linear','log'].indexOf(posAxis.type)!==-1) ||
                        (Plotly.Lib.isDateTime(trace.name) &&
                         posAxis.type==='date')
                    )) {
                pos0 = trace.name;
            }
            else pos0 = gd.numboxes;
            pos0 = posAxis.d2c(pos0);
            pos = dst.map(function(){ return pos0; });
        }

        var dv = Plotly.Lib.distinctVals(pos),
            posVals = dv.vals,
            dPos = dv.minDiff/2,
            posLength = posVals.length,
            cd = [],
            pts = [],
            bins = [];

        // find x (y) values
        for (i = 0; i < posLength; ++i) {
            var posVal = posVals[i];
            cd[i] = {pos: posVal};
            pts[i] = [];
            bins[i] = posVal - dPos;
        }
        bins.push(posVals[posLength-1] + dPos);

        // size autorange based on all source points
        // position happens afterward when we know all the x values
        Plotly.Axes.expand(dstAxis, dst, {padded: true});

        // bin the distribution points
        var dstLength = dst.length;
        for (i = 0; i < dstLength; ++i) {
            var v = dst[i];
            if(!$.isNumeric(v)) return;
            var n = Plotly.Lib.findBin(pos[i], bins);
            if(n>=0 && n<dstLength) pts[n].push(v);
        }

        // interpolate an array given a (possibly non-integer) index n
        // clip the ends to the extreme values in the array
        // special version for box plots: index you get is half a point too high
        // see http://en.wikipedia.org/wiki/Percentile#Nearest_rank but note
        // that this definition indexes from 1 rather than 0, so we subtract 1/2 instead of add
        function interp(arr,n) {
            n-=0.5;
            if(n<0) return arr[0];
            if(n>arr.length-1) return arr[arr.length-1];
            var frac = n%1;
            return frac * arr[Math.ceil(n)] + (1-frac) * arr[Math.floor(n)];
        }

        // sort the bins and calculate the stats
        for (i = 0; i < pts.length; ++i) {
            var v = pts[i].sort(function(a, b){ return a - b; }),
                l = v.length,
                p = cd[i];

            p.dst = v;  // put all points into calcdata
            p.min = v[0];
            p.max = v[l-1];
            p.mean = Plotly.Lib.mean(v,l);
            p.sd = Plotly.Lib.stdev(v,l,p.mean);
            p.q1 = interp(v,l/4); // first quartile
            p.med = interp(v,l/2); // median
            p.q3 = interp(v,0.75*l); // third quartile
            // lower and upper fences - last point inside
            // 1.5 interquartile ranges from quartiles
            p.lf = Math.min(p.q1, v[
                Math.min(Plotly.Lib.findBin(2.5*p.q1-1.5*p.q3,v,true)+1, l-1)]);
            p.uf = Math.max(p.q3,v[
                Math.max(Plotly.Lib.findBin(2.5*p.q3-1.5*p.q1,v), 0)]);
            // lower and upper outliers - 3 IQR out (don't clip to max/min,
            // this is only for discriminating suspected & far outliers)
            p.lo = 4*p.q1-3*p.q3;
            p.uo = 4*p.q3-3*p.q1;
        }

        // remove empty bins
        cd = cd.filter(function(p){ return p.dst && p.dst.length; });
        if(!cd.length) return [{t: {emptybox: true}}];

        cd[0].t = {boxnum: gd.numboxes, dPos: dPos};
        gd.numboxes++;
        return cd;
    };

    boxes.setPositions = function(gd, plotinfo) {
        var fullLayout = gd._fullLayout,
            xa = plotinfo.x(),
            ya = plotinfo.y(),
            orientations = ['v', 'h'],
            posAxis, dstAxis, i, j, k;

        for (i=0; i < orientations.length; ++i) {
            var orientation = orientations[i],
                boxlist = [],
                boxpointlist = [],
                minPad = 0,
                maxPad = 0;

            // set axis via orientation
            if (orientation==='h') {
                posAxis = ya;
                dstAxis = xa;
            } else {
                posAxis = xa;
                dstAxis = ya;
            }

            // make list of boxes
            for (j=0; j < gd.calcdata.length; ++j) {
                var cd = gd.calcdata[j],
                    t = cd[0].t,
                    trace = cd[0].trace;
                if (trace.visible!==false && Plotly.Plots.isBox(trace.type) &&
                        !t.emptybox &&
                        trace.orientation===orientation &&
                        trace.xaxis===xa._id &&
                        trace.yaxis===ya._id) {
                    boxlist.push(j);
                    if (trace.boxpoints!==false) {
                        minPad = Math.max(minPad, trace.jitter-trace.pointpos-1);
                        maxPad = Math.max(maxPad, trace.jitter+trace.pointpos-1);
                    }
                }
            }

            // make list of box points
            for (j=0; j < boxlist.length; ++j) {
                for (k=0; k < gd.calcdata[j].length; ++k) {
                    boxpointlist.push(gd.calcdata[j][k].pos);
                }
            }
            if (!boxpointlist) return;

            // box plots - update dPos based on multiple traces
            // and then use for posAxis autorange

            var boxdv = Plotly.Lib.distinctVals(boxpointlist),
                dPos = boxdv.minDiff/2;

            // if there's no duplication of x points,
            // disable 'group' mode by setting numboxes=1
            if(boxpointlist.length===boxdv.vals.length) gd.numboxes = 1;

            // check for forced minimum dtick
            Plotly.Axes.minDtick(posAxis, boxdv.minDiff, boxdv.vals[0], true);

            // set the width of all boxes
            for (i=0; i < boxlist.length; ++i) {
                gd.calcdata[i][0].t.dPos = dPos;
            }

            // autoscale the x axis - including space for points if they're off the side
            // TODO: this will overdo it if the outermost boxes don't have
            // their points as far out as the other boxes
            var padfactor = (1-fullLayout.boxgap) * (1-fullLayout.boxgroupgap) *
                    dPos / gd.numboxes;
            Plotly.Axes.expand(posAxis, boxdv.vals, {
                vpadminus: dPos+minPad*padfactor,
                vpadplus: dPos+maxPad*padfactor
            });
        }
    };

    // repeatable pseudorandom generator
    var randSeed = 2000000000;

    function seed() {
        randSeed = 2000000000;
    }

    function rand() {
        var lastVal = randSeed;
        randSeed = (69069*randSeed + 1)%4294967296;
        // don't let consecutive vals be too close together
        // gets away from really trying to be random, in favor of better local uniformity
        if(Math.abs(randSeed - lastVal) < 429496729) return rand();
        return randSeed/4294967296;
    }

    // constants for dynamic jitter (ie less jitter for sparser points)
    var JITTERCOUNT = 5, // points either side of this to include
        JITTERSPREAD = 0.01; // fraction of IQR to count as "dense"

    boxes.plot = function(gd, plotinfo, cdbox) {
        var fullLayout = gd._fullLayout,
            xa = plotinfo.x(),
            ya = plotinfo.y(),
            posAxis, dstAxis;

        var boxtraces = plotinfo.plot.select('.boxlayer')
            .selectAll('g.trace.boxes')
                .data(cdbox)
          .enter().append('g')
            .attr('class','trace boxes');

        boxtraces.each(function(d){
            var t = d[0].t,
                trace = d[0].trace,
                group = (fullLayout.boxmode==='group' && gd.numboxes>1),
                // box half width
                bdPos = t.dPos*(1-fullLayout.boxgap)*(1-fullLayout.boxgroupgap)/(group ? gd.numboxes : 1),
                // box center offset
                bPos = group ? 2*t.dPos*(-0.5+(t.boxnum+0.5)/gd.numboxes)*(1-fullLayout.boxgap) : 0,
                // whisker width
                wdPos = bdPos*trace.whiskerwidth;
            if(trace.visible===false || t.emptybox) {
                d3.select(this).remove();
                return;
            }

            // set axis via orientation
            if (trace.orientation==='h') {
                posAxis = ya;
                dstAxis = xa;
            } else {
                posAxis = xa;
                dstAxis = ya;
            }

            // save the box size and box position for use by hover
            t.bPos = bPos;
            t.bdPos = bdPos;

            // repeatable pseudorandom number generator
            seed();

            // boxes and whiskers
            d3.select(this).selectAll('path.box')
                .data(Plotly.Lib.identity)
                .enter().append('path')
                .attr('class','box')
                .each(function(d){
                    var posc = posAxis.c2p(d.pos + bPos, true),
                        pos0 = posAxis.c2p(d.pos + bPos - bdPos, true),
                        pos1 = posAxis.c2p(d.pos + bPos + bdPos, true),
                        posw0 = posAxis.c2p(d.pos + bPos - wdPos, true),
                        posw1 = posAxis.c2p(d.pos + bPos + wdPos, true),
                        q1 = dstAxis.c2p(d.q1, true),
                        q3 = dstAxis.c2p(d.q3, true),
                        // make sure median isn't identical to either of the
                        // quartiles, so we can see it
                        m = Plotly.Lib.constrain(dstAxis.c2p(d.med, true),
                            Math.min(q1, q3)+1, Math.max(q1, q3)-1),
                        lf = dstAxis.c2p(trace.boxpoints===false ? d.min : d.lf, true),
                        uf = dstAxis.c2p(trace.boxpoints===false ? d.max : d.uf, true);
                    if (trace.orientation==='h') {
                        d3.select(this).attr('d',
                            'M'+m+','+pos0+'V'+pos1+ // median line
                            'M'+q1+','+pos0+'V'+pos1+'H'+q3+'V'+pos0+'Z'+ // box
                            'M'+q1+','+posc+','+'H'+lf+'M'+q3+','+posc+'H'+uf+ // whiskers
                            ((trace.whiskerwidth===0) ? '' : // whisker caps
                                'M'+lf+','+posw0+'V'+posw1+'M'+uf+','+posw0+'V'+posw1));
                    } else {
                        d3.select(this).attr('d',
                            'M'+pos0+','+m+'H'+pos1+ // median line
                            'M'+pos0+','+q1+'H'+pos1+'V'+q3+'H'+pos0+'Z'+ // box
                            'M'+posc+','+q1+'V'+lf+'M'+posc+','+q3+'V'+uf+ // whiskers
                            ((trace.whiskerwidth===0) ? '' : // whisker caps
                                'M'+posw0+','+lf+'H'+posw1+'M'+posw0+','+uf+'H'+posw1));
                    }
                });

            // draw points, if desired
            if(trace.boxpoints) {
                d3.select(this).selectAll('g.points')
                    // since box plot points get an extra level of nesting, each
                    // box needs the trace styling info
                    .data(function(d){
                        d.forEach(function(v){
                            v.t = t;
                            v.trace = trace;
                        });
                        return d;
                    })
                    .enter().append('g')
                    .attr('class','points')
                  .selectAll('path')
                    .data(function(d){
                        var pts = (trace.boxpoints==='all') ? d.dst :
                                d.dst.filter(function(v){ return (v<d.lf || v>d.uf); }),
                            spreadLimit = (d.q3 - d.q1) * JITTERSPREAD,
                            jitterFactors = [],
                            maxJitterFactor = 0,
                            i,
                            i0, i1,
                            pmin,
                            pmax,
                            jitterFactor,
                            newJitter;

                        // dynamic jitter
                        if(trace.jitter) {
                            for(i=0; i<pts.length; i++) {
                                i0 = Math.max(0, i-JITTERCOUNT);
                                pmin = pts[i0];
                                i1 = Math.min(pts.length-1, i+JITTERCOUNT);
                                pmax = pts[i1];

                                if(trace.boxpoints!=='all') {
                                    if(pts[i]<d.lf) pmax = Math.min(pmax, d.lf);
                                    else pmin = Math.max(pmin, d.uf);
                                }

                                jitterFactor = Math.sqrt(spreadLimit * (i1-i0) / (pmax-pmin)) || 0;
                                jitterFactor = Plotly.Lib.constrain(Math.abs(jitterFactor), 0, 1);

                                jitterFactors.push(jitterFactor);
                                maxJitterFactor = Math.max(jitterFactor, maxJitterFactor);
                            }
                            newJitter = trace.jitter * 2 / maxJitterFactor;
                        }

                        return pts.map(function(v, i){
                            var posOffset = trace.pointpos,
                                p;
                            if(trace.jitter) {
                                posOffset += newJitter * jitterFactors[i] * (rand()-0.5);
                            }

                            if (trace.orientation==='h') {
                                p = {
                                    y: d.pos + posOffset*bdPos + bPos,
                                    x: v
                                };
                            } else {
                                p = {
                                    x: d.pos + posOffset*bdPos + bPos,
                                    y: v
                                };
                            }

                            // tag suspected outliers
                            if(trace.boxpoints==='suspectedoutliers' && v<d.uo && v>d.lo) {
                                p.so=true;
                            }
                            return p;
                        });
                    })
                    .enter().append('path')
                    .call(Plotly.Drawing.translatePoints, xa, ya);
            }
            // draw mean (and stdev diamond) if desired
            if(trace.boxmean) {
                d3.select(this).selectAll('path.mean')
                    .data(Plotly.Lib.identity)
                    .enter().append('path')
                    .attr('class','mean')
                    .style('fill','none')
                    .each(function(d){
                        var posc = posAxis.c2p(d.pos + bPos, true),
                            pos0 = posAxis.c2p(d.pos + bPos - bdPos, true),
                            pos1 = posAxis.c2p(d.pos + bPos + bdPos, true),
                            m = dstAxis.c2p(d.mean, true),
                            sl = dstAxis.c2p(d.mean-d.sd, true),
                            sh = dstAxis.c2p(d.mean+d.sd, true);
                        if (trace.orientation==='h') {
                        d3.select(this).attr('d',
                            'M'+m+','+pos0+'V'+pos1+
                            ((trace.boxmean!=='sd') ? '' :
                                'm0,0L'+sl+','+posc+'L'+m+','+pos0+'L'+sh+','+posc+'Z'));
                        } else {
                        d3.select(this).attr('d',
                            'M'+pos0+','+m+'H'+pos1+
                            ((trace.boxmean!=='sd') ? '' :
                                'm0,0L'+posc+','+sl+'L'+pos0+','+m+'L'+posc+','+sh+'Z'));
                        }
                    });
            }
        });
    };

    boxes.style = function(gp) {
        var s = gp.selectAll('g.trace.boxes');

        s.style('opacity', function(d){ return d[0].trace.opacity; })
            .each(function(d){
                var trace = d[0].trace,
                    lineWidth = trace.line.width;
                d3.select(this).selectAll('path.box')
                    .style('stroke-width',lineWidth+'px')
                    .call(Plotly.Color.stroke, trace.line.color)
                    .call(Plotly.Color.fill, trace.fillcolor);
                d3.select(this).selectAll('path.mean')
                    .style({
                        'stroke-width': lineWidth,
                        'stroke-dasharray': (2*lineWidth)+'px,'+lineWidth+'px'
                    })
                    .call(Plotly.Color.stroke, trace.line.color);
            })
            .selectAll('g.points')
                .each(function(d){
                    var trace = d.trace;

                    d3.select(this).selectAll('path')
                        .call(Plotly.Drawing.pointStyle, trace);
                });
    };

    boxes.hoverPoints = function(pointData, xval, yval, hovermode) {
        // closest mode: handicap box plots a little relative to others
        var cd = pointData.cd,
            trace = cd[0].trace,
            t = cd[0].t,
            xa = pointData.xa,
            ya = pointData.ya,
            dd = (hovermode==='closest') ? Plotly.Fx.MAXDIST/5 : 0, // TODO
            closeData = [],
            dx, dy, distfn, posLetter, posAxis, posText, dst, dstLetter, dstAxis;

        if (trace.orientation==='h') {
            dx = function(di){
                return Plotly.Fx.inbox(di.min - xval, di.max - xval);
            };
            dy = function(di){
                var pos = di.pos + t.bPos - yval;
                return Plotly.Fx.inbox(pos - t.bdPos, pos + t.bdPos) + dd;
            };
            posLetter = 'y';
            posAxis = ya;
            dstLetter = 'x';
            dstAxis = xa;
        } else {
            dx = function(di){
                var pos = di.pos + t.bPos - xval;
                return Plotly.Fx.inbox(pos - t.bdPos, pos + t.bdPos) + dd;
            };
            dy = function(di){
                return Plotly.Fx.inbox(di.min - yval, di.max - yval);
            };
            posLetter = 'x';
            posAxis = xa;
            dstLetter = 'y';
            dstAxis = ya;
        }

        distfn = Plotly.Fx.getDistanceFunction(hovermode, dx, dy);
        Plotly.Fx.getClosest(cd, distfn, pointData);

        // skip the rest (for this trace) if we didn't find a close point
        if(pointData.index===false) return;

        // create the item(s) in closedata for this point

        // the closest data point
        var di = cd[pointData.index],
            lc = trace.line.color,
            mc = (trace.marker||{}).color;
        if(Plotly.Color.opacity(lc) && trace.line.width) pointData.color = lc;
        else if(Plotly.Color.opacity(mc) && trace.boxpoints) pointData.color = mc;
        else pointData.color = trace.fillcolor;

        pointData[posLetter+'0'] = posAxis.c2p(di.pos + t.bPos - t.bdPos, true);
        pointData[posLetter+'1'] = posAxis.c2p(di.pos + t.bPos + t.bdPos, true);

        posText = Plotly.Axes.tickText(posAxis, posAxis.c2l(di.pos), 'hover').text;
        if(hovermode==='closest') {
            if(posText!==pointData.name) pointData.name += ': ' + posText;
        } else {
            pointData[posLetter+'LabelVal'] = di.pos;
            if (posText===pointData.name) pointData.name = '';
        }

        // box plots: each "point" gets many labels
        var usedVals = {},
            attrs = ['med','min','q1','q3','max'],
            attr,
            pointData2;
        if(trace.boxmean) attrs.push('mean');
        if(trace.boxpoints) [].push.apply(attrs,['lf', 'uf']);

        for (var i=0; i<attrs.length; i++) {
            attr = attrs[i];

            if(!(attr in di) || (di[attr] in usedVals)) continue;
            usedVals[di[attr]] = true;

            // copy out to a new object for each value to label
            dst = dstAxis.c2p(di[attr], true);
            pointData2 = $.extend({}, pointData);
            pointData2[dstLetter+'0'] = pointData2[dstLetter+'1'] = dst;
            pointData2[dstLetter+'LabelVal'] = di[attr];
            pointData2.attr = attr;

            if(attr==='mean' && ('sd' in di) && trace.boxmean==='sd') {
                pointData2[dstLetter+'err'] = di.sd;
            }
            pointData.name = ''; // only keep name on the first item (median)
            closeData.push(pointData2);
        }
        return closeData;
    };

}()); // end Boxes object definition
