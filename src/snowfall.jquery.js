/*  Snowfall jquery plugin

    ====================================================================
    LICENSE
    ====================================================================
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing, software
       distributed under the License is distributed on an "AS IS" BASIS,
       WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
       See the License for the specific language governing permissions and
       limitations under the License.
    ====================================================================

    Version 1.51 Dec 2nd 2012
    // fixed bug where snow collection didn't happen if a valid doctype was declared.

    Version 1.5 Oct 5th 2011
    Added collecting snow! Uses the canvas element to collect snow. In order to initialize snow collection use the following

    $(document).snowfall({collection : 'element'});

    element = any valid jquery selector.

    The plugin then creates a canvas above every element that matches the selector, and collects the snow. If there are a varrying amount of elements the
    flakes get assigned a random one on start they will collide.

    Version 1.4 Dec 8th 2010
    Fixed issues (I hope) with scroll bars flickering due to snow going over the edge of the screen.
    Added round snowflakes via css, will not work for any version of IE. - Thanks to Luke Barker of http://www.infinite-eye.com/
    Added shadows as an option via css again will not work with IE. The idea behind shadows, is to show flakes on lighter colored web sites - Thanks Yutt

    Version 1.3.1 Nov 25th 2010
    Updated script that caused flakes not to show at all if plugin was initialized with no options, also added the fixes that Han Bongers suggested

    Developed by Jason Brown for any bugs or questions email me at loktar69@hotmail
    info on the plugin is located on Somethinghitme.com

    values for snow options are

    flakeCount,
    flakeColor,
    flakeIndex,
    minSize,
    maxSize,
    minSpeed,
    maxSpeed,
    round,      true or false, makes the snowflakes rounded if the browser supports it.
    shadow      true or false, gives the snowflakes a shadow if the browser supports it.

    Example Usage :
    $(document).snowfall({flakeCount : 100, maxSpeed : 10});

    -or-

    $('#element').snowfall({flakeCount : 800, maxSpeed : 5, maxSize : 5});

    -or with defaults-

    $(document).snowfall();

    - To clear -
    $('#element').snowfall('clear');
*/

// requestAnimationFrame polyfill from https://github.com/darius/requestAnimationFrame
if (!Date.now)
    Date.now = function() { return new Date().getTime(); };

(function() {
    'use strict';

    var vendors = ['webkit', 'moz'];
    for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
        var vp = vendors[i];
        window.requestAnimationFrame = window[vp+'RequestAnimationFrame'];
        window.cancelAnimationFrame = (window[vp+'CancelAnimationFrame']
                                   || window[vp+'CancelRequestAnimationFrame']);
    }
    if (/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent) // iOS6 is buggy
        || !window.requestAnimationFrame || !window.cancelAnimationFrame) {
        var lastTime = 0;
        window.requestAnimationFrame = function(callback) {
            var now = Date.now();
            var nextTime = Math.max(lastTime + 16, now);
            return setTimeout(function() { callback(lastTime = nextTime); },
                              nextTime - now);
        };
        window.cancelAnimationFrame = clearTimeout;
    }
}());

(function($){
    $.snowfall = {
        snowTimeout: 0,
        flakes: [],
        last: 0,
        random: function(min, max){
                return min + Math.random()*(max-min);
            },

        // Snow flake object
        Flake: function(_el, _gr, _size, _speed, _id) {
            var random = $.snowfall.random;
            // Flake properties
            this.x  = random(_gr.widthOffset, _gr.elWidth - _gr.widthOffset);
            this.y  = random(0, _gr.elHeight);
            this.size = _size;
            this.speed = _speed;
            this.step = 0;
            this.stepSize = random(1,10) / 100;
            this.id = _id;
            this.group = _gr;

            if(_gr.options.collection){
                this.target = canvasCollection[random(0,canvasCollection.length-1)];
            }

            var flakeMarkup = null;

            if(_gr.options.image){
                flakeMarkup = document.createElement("img");
                flakeMarkup.src = _gr.options.image;
            }else{
                flakeMarkup = document.createElement("div");
                $(flakeMarkup).css({'background' : _gr.options.flakeColor});
            }

            $(flakeMarkup).attr({
                'class': 'snowfall-flakes'
            }).css({
                'width' : this.size,
                'height' : this.size,
                'position' : _gr.options.flakePosition,
                'top' : this.y,
                'left' : this.x,
                'fontSize' : 0,
                'zIndex' : _gr.options.flakeIndex
            }).data('snowfall-id', this.id);

            if($(_el).get(0).tagName === $(document).get(0).tagName){
                $('body').append($(flakeMarkup));
                _el = $('body');
            }else{
                $(_el).append($(flakeMarkup));
            }

            this.element = flakeMarkup;

            // Update function, used to update the snow flakes, and checks current snowflake against bounds
            this.update = function(elapsed){
                var fpsRatio = elapsed / (1/this.group.options.fps*1000);
                this.y += this.speed*fpsRatio;

                if(this.y > (this.group.elHeight) - (this.size  + 6)){
                    this.reset();
                }

                this.element.style.top = this.y + 'px';
                this.element.style.left = this.x + 'px';

                this.step += this.stepSize*fpsRatio;

                if (this.group.doRatio === false) {
                    this.x += Math.cos(this.step)*fpsRatio;
                } else {
                    this.x += (this.group.doRatio + Math.cos(this.step))*fpsRatio;
                }

                // Pileup check
                if(this.group.options.collection){
                    if(this.x > this.target.x && this.x < this.target.width + this.target.x && this.y > this.target.y && this.y < this.target.height + this.target.y){
                        var ctx = this.target.element.getContext("2d"),
                            curX = this.x - this.target.x,
                            curY = this.y - this.target.y,
                            colData = this.target.colData;

                        if(colData[parseInt(curX)][parseInt(curY+this.speed+this.size)] !== undefined || curY+this.speed+this.size > this.target.height){
                            if(curY+this.speed+this.size > this.target.height){
                                while(curY+this.speed+this.size > this.target.height && this.speed > 0){
                                    this.speed *= .5;
                                }

                                ctx.fillStyle = "#fff";

                                if(colData[parseInt(curX)][parseInt(curY+this.speed+this.size)] == undefined){
                                    colData[parseInt(curX)][parseInt(curY+this.speed+this.size)] = 1;
                                    ctx.fillRect(curX, (curY)+this.speed+this.size, this.size, this.size);
                                }else{
                                    colData[parseInt(curX)][parseInt(curY+this.speed)] = 1;
                                    ctx.fillRect(curX, curY+this.speed, this.size, this.size);
                                }
                                this.reset();
                            }else{
                                // flow to the sides
                                this.speed = 1;
                                this.stepSize = 0;

                                if(parseInt(curX)+1 < this.target.width && colData[parseInt(curX)+1][parseInt(curY)+1] == undefined ){
                                    // go left
                                    this.x++;
                                }else if(parseInt(curX)-1 > 0 && colData[parseInt(curX)-1][parseInt(curY)+1] == undefined ){
                                    // go right
                                    this.x--;
                                }else{
                                    //stop
                                    ctx.fillStyle = "#fff";
                                    ctx.fillRect(curX, curY, this.size, this.size);
                                    colData[parseInt(curX)][parseInt(curY)] = 1;
                                    this.reset();
                                }
                            }
                        }
                    }
                }

                if(this.x + this.size > (this.group.elWidth) - this.group.widthOffset || this.x < this.group.widthOffset){
                    this.reset();
                }
            };

            // Resets the snowflake once it reaches one of the bounds set
            this.reset = function(){
                this.y = 0;
                this.x = random(this.group.widthOffset, this.group.elWidth - this.group.widthOffset);
                this.stepSize = random(1,10) / 100;
                this.size = random((_gr.options.minSize * 100), (_gr.options.maxSize * 100)) / 100;
                this.element.style.width = this.size + 'px';
                this.element.style.height = this.size + 'px';
                this.speed = random(_gr.options.minSpeed, _gr.options.maxSpeed);
            }
        },
        fall: function(element, options) {
            var defaults = {
                    flakeCount : 35,
                    flakeColor : '#ffffff',
                    flakePosition: 'absolute',
                    flakeIndex: 999999,
                    minSize : 1,
                    maxSize : 2,
                    minSpeed : 1,
                    maxSpeed : 5,
                    fps : 30,
                    round : false,
                    shadow : false,
                    scale : true,
                    collection : false,
                    collectionHeight : 40,
                    deviceorientation : false
                };
            this.options = $.extend(defaults, options);

            $(element).data("snowfall", this);

            // local vars
            this.elHeight = $(element).height();
            this.elWidth = $(element).width();
            this.widthOffset = 0;
            this.doRatio = false;

            // Collection Piece ******************************
            if(this.options.collection !== false){
                var testElem = document.createElement('canvas');
                if(!!(testElem.getContext && testElem.getContext('2d'))){
                    var canvasCollection = [],
                        elements = $(this.options.collection),
                        collectionHeight = this.options.collectionHeight;

                    for(var i=0; i < elements.length; i++){
                        var bounds = elements[i].getBoundingClientRect(),
                            $canvas = $('<canvas/>',
                                {
                                    'class' : 'snowfall-canvas'
                                }),
                            collisionData = [];

                        if(bounds.top-collectionHeight > 0){
                            $('body').append($canvas);

                            $canvas.css({
                                'position' : this.options.flakePosition,
                                'left'     : bounds.left + 'px',
                                'top'      : bounds.top-collectionHeight + 'px'
                            })
                                .prop({
                                    width: bounds.width,
                                    height: collectionHeight
                                });

                            for(var w = 0; w < bounds.width; w++){
                                collisionData[w] = [];
                            }

                            canvasCollection.push({
                                element : $canvas.get(0),
                                x : bounds.left,
                                y : bounds.top-collectionHeight,
                                width : bounds.width,
                                height: collectionHeight,
                                colData : collisionData
                            });
                        }
                    }
                }else{
                    // Canvas element isnt supported
                    this.options.collection = false;
                }
            }
            // ************************************************

            // This will reduce the horizontal scroll bar from displaying, when the effect is applied to the whole page
            if($(element).get(0).tagName === $(document).get(0).tagName){
                this.widthOffset = 25;
            }

            var _this = this;

            // Bind the window resize event so we can get the innerHeight again
            $(window).bind("resize", function(){
                setTimeout(function(){
                    _this.elHeight = $(element)[0].clientHeight;
                    if (_this.options.scale === true && _this.elWidth !== $(element)[0].offsetWidth) {
                        var ratio = $(element)[0].offsetWidth / _this.elWidth;
                        $(element).children('.snowfall-flakes').each(function(){
                            var id = $(this).data('snowfall-id');
                            $.each($.snowfall.flakes, function(i, e){
                                if (e.id == id) {
                                    e.x = e.x*ratio;
                                    return false;
                                }
                            });
                        });
                    }
                    _this.elWidth = $(element)[0].offsetWidth;
                }, 100);
            });


            // initialize the flakes
            for(i = 0; i < this.options.flakeCount; i+=1){
                $.snowfall.addFlake(element, this);
            }

            // This adds the style to make the snowflakes round via border radius property
            if(this.options.round){
                $('.snowfall-flakes').css({'-moz-border-radius' : this.options.maxSize, '-webkit-border-radius' : this.options.maxSize, 'border-radius' : this.options.maxSize});
            }

            // This adds shadows just below the snowflake so they pop a bit on lighter colored web pages
            if(this.options.shadow){
                $('.snowfall-flakes').css({'-moz-box-shadow' : '1px 1px 1px #555', '-webkit-box-shadow' : '1px 1px 1px #555', 'box-shadow' : '1px 1px 1px #555'});
            }

            // On newer Macbooks Snowflakes will fall based on deviceorientation
            if (this.options.deviceorientation) {
                $(window).bind('deviceorientation', function(event) {
                    doRatio = event.originalEvent.gamma * 0.1;
                });
            }

            $.snowfall.start();

            // clears the snowflakes
            this.clear = function(){
                $('.snowfall-canvas').remove();
                $(element).children('.snowfall-flakes').remove();
                $.snowfall.removeFlakes(element);
                $.snowfall.stop();
            }
        },

        addFlake: function(_el, _gr) {
            var flakeId = 0;
            $.each(this.flakes, function(i, flake){
                if (flake.id == flakeId) flakeId++;
                if (flake.id > flakeId) return false;
            });
            this.flakes.push(new this.Flake(_el, _gr, this.random((_gr.options.minSize * 100), (_gr.options.maxSize * 100)) / 100, this.random(_gr.options.minSpeed, _gr.options.maxSpeed), flakeId));
            this.flakes.sort(function(a, b){return a.id - b.id});
        },

        removeFlakes: function(_el) {
            var newFlakes = this.flakes.slice();
            $.each(this.flakes, function(i, flake){
                $(_el).children('.snowfall-flakes').each(function(){
                    if ($(this).data('snowfall-id') === flake.id) {
                        $.each(newFlakes, function(j, e){
                            if (flake.id == e.id) {
                                newFlakes.splice(j, 1);
                                return false;
                            }
                        })
                    }
                });
            });
            newFlakes.sort(function(a, b){return a.id - b.id});
            this.flakes = newFlakes;
        },

        // this controls flow of the updating snow
        snow: function(timestamp) {
            for( i = 0; i < this.flakes.length; i += 1){
                this.flakes[i].update(timestamp-this.last);
            }
            this.last = timestamp;

            this.snowTimeout = requestAnimationFrame(function(ts){$.snowfall.snow(ts)});
        },

        start: function() {
            if (!this.snowTimeout) this.snowTimeout = requestAnimationFrame(function(ts){$.snowfall.snow(ts)});
        },

        stop: function() {
            if (!this.flakes.length) cancelAnimationFrame(this.snowTimeout);
        }
    };

    // Initialize the options and the plugin
    $.fn.snowfall = function(options){
        if(typeof(options) == "object" || options == undefined){
                 return this.each(function(i){
                    (new $.snowfall.fall(this, options));
                });
        }else if (typeof(options) == "string") {
            return this.each(function(i){
                var snow = $(this).data('snowfall');
                if(snow){
                    snow.clear();
                }
            });
        }
    };
})(jQuery);