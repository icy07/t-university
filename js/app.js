(() => {
    "use strict";
    var version = "1.3.1";
    function clamp(min, input, max) {
        return Math.max(min, Math.min(input, max));
    }
    function lerp(x, y, t) {
        return (1 - t) * x + t * y;
    }
    function damp(x, y, lambda, deltaTime) {
        return lerp(x, y, 1 - Math.exp(-lambda * deltaTime));
    }
    function modulo(n, d) {
        return (n % d + d) % d;
    }
    var Animate = class {
        isRunning=false;
        value=0;
        from=0;
        to=0;
        currentTime=0;
        lerp;
        duration;
        easing;
        onUpdate;
        advance(deltaTime) {
            if (!this.isRunning) return;
            let completed = false;
            if (this.duration && this.easing) {
                this.currentTime += deltaTime;
                const linearProgress = clamp(0, this.currentTime / this.duration, 1);
                completed = linearProgress >= 1;
                const easedProgress = completed ? 1 : this.easing(linearProgress);
                this.value = this.from + (this.to - this.from) * easedProgress;
            } else if (this.lerp) {
                this.value = damp(this.value, this.to, this.lerp * 60, deltaTime);
                if (Math.round(this.value) === this.to) {
                    this.value = this.to;
                    completed = true;
                }
            } else {
                this.value = this.to;
                completed = true;
            }
            if (completed) this.stop();
            this.onUpdate?.(this.value, completed);
        }
        stop() {
            this.isRunning = false;
        }
        fromTo(from, to, {lerp: lerp2, duration, easing, onStart, onUpdate}) {
            this.from = this.value = from;
            this.to = to;
            this.lerp = lerp2;
            this.duration = duration;
            this.easing = easing;
            this.currentTime = 0;
            this.isRunning = true;
            onStart?.();
            this.onUpdate = onUpdate;
        }
    };
    function debounce(callback, delay) {
        let timer;
        return function(...args) {
            let context = this;
            clearTimeout(timer);
            timer = setTimeout((() => {
                timer = void 0;
                callback.apply(context, args);
            }), delay);
        };
    }
    var Dimensions = class {
        constructor(wrapper, content, {autoResize = true, debounce: debounceValue = 250} = {}) {
            this.wrapper = wrapper;
            this.content = content;
            if (autoResize) {
                this.debouncedResize = debounce(this.resize, debounceValue);
                if (this.wrapper instanceof Window) window.addEventListener("resize", this.debouncedResize, false); else {
                    this.wrapperResizeObserver = new ResizeObserver(this.debouncedResize);
                    this.wrapperResizeObserver.observe(this.wrapper);
                }
                this.contentResizeObserver = new ResizeObserver(this.debouncedResize);
                this.contentResizeObserver.observe(this.content);
            }
            this.resize();
        }
        width=0;
        height=0;
        scrollHeight=0;
        scrollWidth=0;
        debouncedResize;
        wrapperResizeObserver;
        contentResizeObserver;
        destroy() {
            this.wrapperResizeObserver?.disconnect();
            this.contentResizeObserver?.disconnect();
            if (this.wrapper === window && this.debouncedResize) window.removeEventListener("resize", this.debouncedResize, false);
        }
        resize=() => {
            this.onWrapperResize();
            this.onContentResize();
        };
        onWrapperResize=() => {
            if (this.wrapper instanceof Window) {
                this.width = window.innerWidth;
                this.height = window.innerHeight;
            } else {
                this.width = this.wrapper.clientWidth;
                this.height = this.wrapper.clientHeight;
            }
        };
        onContentResize=() => {
            if (this.wrapper instanceof Window) {
                this.scrollHeight = this.content.scrollHeight;
                this.scrollWidth = this.content.scrollWidth;
            } else {
                this.scrollHeight = this.wrapper.scrollHeight;
                this.scrollWidth = this.wrapper.scrollWidth;
            }
        };
        get limit() {
            return {
                x: this.scrollWidth - this.width,
                y: this.scrollHeight - this.height
            };
        }
    };
    var Emitter = class {
        events={};
        emit(event, ...args) {
            let callbacks = this.events[event] || [];
            for (let i = 0, length = callbacks.length; i < length; i++) callbacks[i]?.(...args);
        }
        on(event, cb) {
            this.events[event]?.push(cb) || (this.events[event] = [ cb ]);
            return () => {
                this.events[event] = this.events[event]?.filter((i => cb !== i));
            };
        }
        off(event, callback) {
            this.events[event] = this.events[event]?.filter((i => callback !== i));
        }
        destroy() {
            this.events = {};
        }
    };
    var LINE_HEIGHT = 100 / 6;
    var listenerOptions = {
        passive: false
    };
    var VirtualScroll = class {
        constructor(element, options = {
            wheelMultiplier: 1,
            touchMultiplier: 1
        }) {
            this.element = element;
            this.options = options;
            window.addEventListener("resize", this.onWindowResize, false);
            this.onWindowResize();
            this.element.addEventListener("wheel", this.onWheel, listenerOptions);
            this.element.addEventListener("touchstart", this.onTouchStart, listenerOptions);
            this.element.addEventListener("touchmove", this.onTouchMove, listenerOptions);
            this.element.addEventListener("touchend", this.onTouchEnd, listenerOptions);
        }
        touchStart={
            x: 0,
            y: 0
        };
        lastDelta={
            x: 0,
            y: 0
        };
        window={
            width: 0,
            height: 0
        };
        emitter=new Emitter;
        on(event, callback) {
            return this.emitter.on(event, callback);
        }
        destroy() {
            this.emitter.destroy();
            window.removeEventListener("resize", this.onWindowResize, false);
            this.element.removeEventListener("wheel", this.onWheel, listenerOptions);
            this.element.removeEventListener("touchstart", this.onTouchStart, listenerOptions);
            this.element.removeEventListener("touchmove", this.onTouchMove, listenerOptions);
            this.element.removeEventListener("touchend", this.onTouchEnd, listenerOptions);
        }
        onTouchStart=event => {
            const {clientX, clientY} = event.targetTouches ? event.targetTouches[0] : event;
            this.touchStart.x = clientX;
            this.touchStart.y = clientY;
            this.lastDelta = {
                x: 0,
                y: 0
            };
            this.emitter.emit("scroll", {
                deltaX: 0,
                deltaY: 0,
                event
            });
        };
        onTouchMove=event => {
            const {clientX, clientY} = event.targetTouches ? event.targetTouches[0] : event;
            const deltaX = -(clientX - this.touchStart.x) * this.options.touchMultiplier;
            const deltaY = -(clientY - this.touchStart.y) * this.options.touchMultiplier;
            this.touchStart.x = clientX;
            this.touchStart.y = clientY;
            this.lastDelta = {
                x: deltaX,
                y: deltaY
            };
            this.emitter.emit("scroll", {
                deltaX,
                deltaY,
                event
            });
        };
        onTouchEnd=event => {
            this.emitter.emit("scroll", {
                deltaX: this.lastDelta.x,
                deltaY: this.lastDelta.y,
                event
            });
        };
        onWheel=event => {
            let {deltaX, deltaY, deltaMode} = event;
            const multiplierX = deltaMode === 1 ? LINE_HEIGHT : deltaMode === 2 ? this.window.width : 1;
            const multiplierY = deltaMode === 1 ? LINE_HEIGHT : deltaMode === 2 ? this.window.height : 1;
            deltaX *= multiplierX;
            deltaY *= multiplierY;
            deltaX *= this.options.wheelMultiplier;
            deltaY *= this.options.wheelMultiplier;
            this.emitter.emit("scroll", {
                deltaX,
                deltaY,
                event
            });
        };
        onWindowResize=() => {
            this.window = {
                width: window.innerWidth,
                height: window.innerHeight
            };
        };
    };
    var Lenis = class {
        _isScrolling=false;
        _isStopped=false;
        _isLocked=false;
        _preventNextNativeScrollEvent=false;
        _resetVelocityTimeout=null;
        __rafID=null;
        isTouching;
        time=0;
        userData={};
        lastVelocity=0;
        velocity=0;
        direction=0;
        options;
        targetScroll;
        animatedScroll;
        animate=new Animate;
        emitter=new Emitter;
        dimensions;
        virtualScroll;
        constructor({wrapper = window, content = document.documentElement, eventsTarget = wrapper, smoothWheel = true, syncTouch = false, syncTouchLerp = .075, touchInertiaMultiplier = 35, duration, easing = t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), lerp: lerp2 = .1, infinite = false, orientation = "vertical", gestureOrientation = "vertical", touchMultiplier = 1, wheelMultiplier = 1, autoResize = true, prevent, virtualScroll, overscroll = true, autoRaf = false, anchors = false, autoToggle = false, allowNestedScroll = false, __experimental__naiveDimensions = false} = {}) {
            window.lenisVersion = version;
            if (!wrapper || wrapper === document.documentElement) wrapper = window;
            this.options = {
                wrapper,
                content,
                eventsTarget,
                smoothWheel,
                syncTouch,
                syncTouchLerp,
                touchInertiaMultiplier,
                duration,
                easing,
                lerp: lerp2,
                infinite,
                gestureOrientation,
                orientation,
                touchMultiplier,
                wheelMultiplier,
                autoResize,
                prevent,
                virtualScroll,
                overscroll,
                autoRaf,
                anchors,
                autoToggle,
                allowNestedScroll,
                __experimental__naiveDimensions
            };
            this.dimensions = new Dimensions(wrapper, content, {
                autoResize
            });
            this.updateClassName();
            this.targetScroll = this.animatedScroll = this.actualScroll;
            this.options.wrapper.addEventListener("scroll", this.onNativeScroll, false);
            this.options.wrapper.addEventListener("scrollend", this.onScrollEnd, {
                capture: true
            });
            if (this.options.anchors && this.options.wrapper === window) this.options.wrapper.addEventListener("click", this.onClick, false);
            this.options.wrapper.addEventListener("pointerdown", this.onPointerDown, false);
            this.virtualScroll = new VirtualScroll(eventsTarget, {
                touchMultiplier,
                wheelMultiplier
            });
            this.virtualScroll.on("scroll", this.onVirtualScroll);
            if (this.options.autoToggle) this.rootElement.addEventListener("transitionend", this.onTransitionEnd, {
                passive: true
            });
            if (this.options.autoRaf) this.__rafID = requestAnimationFrame(this.raf);
        }
        destroy() {
            this.emitter.destroy();
            this.options.wrapper.removeEventListener("scroll", this.onNativeScroll, false);
            this.options.wrapper.removeEventListener("scrollend", this.onScrollEnd, {
                capture: true
            });
            this.options.wrapper.removeEventListener("pointerdown", this.onPointerDown, false);
            if (this.options.anchors && this.options.wrapper === window) this.options.wrapper.removeEventListener("click", this.onClick, false);
            this.virtualScroll.destroy();
            this.dimensions.destroy();
            this.cleanUpClassName();
            if (this.__rafID) cancelAnimationFrame(this.__rafID);
        }
        on(event, callback) {
            return this.emitter.on(event, callback);
        }
        off(event, callback) {
            return this.emitter.off(event, callback);
        }
        onScrollEnd=e => {
            if (!(e instanceof CustomEvent)) if (this.isScrolling === "smooth" || this.isScrolling === false) e.stopPropagation();
        };
        dispatchScrollendEvent=() => {
            this.options.wrapper.dispatchEvent(new CustomEvent("scrollend", {
                bubbles: this.options.wrapper === window,
                detail: {
                    lenisScrollEnd: true
                }
            }));
        };
        onTransitionEnd=event => {
            if (event.propertyName.includes("overflow")) {
                const property = this.isHorizontal ? "overflow-x" : "overflow-y";
                const overflow = getComputedStyle(this.rootElement)[property];
                if ([ "hidden", "clip" ].includes(overflow)) this.stop(); else this.start();
            }
        };
        setScroll(scroll) {
            if (this.isHorizontal) this.options.wrapper.scrollTo({
                left: scroll,
                behavior: "instant"
            }); else this.options.wrapper.scrollTo({
                top: scroll,
                behavior: "instant"
            });
        }
        onClick=event => {
            const path = event.composedPath();
            const anchor = path.find((node => node instanceof HTMLAnchorElement && (node.getAttribute("href")?.startsWith("#") || node.getAttribute("href")?.startsWith("/#") || node.getAttribute("href")?.startsWith("./#"))));
            if (anchor) {
                const id = anchor.getAttribute("href");
                if (id) {
                    const options = typeof this.options.anchors === "object" && this.options.anchors ? this.options.anchors : void 0;
                    let target = `#${id.split("#")[1]}`;
                    if ([ "#", "/#", "./#", "#top", "/#top", "./#top" ].includes(id)) target = 0;
                    this.scrollTo(target, options);
                }
            }
        };
        onPointerDown=event => {
            if (event.button === 1) this.reset();
        };
        onVirtualScroll=data => {
            if (typeof this.options.virtualScroll === "function" && this.options.virtualScroll(data) === false) return;
            const {deltaX, deltaY, event} = data;
            this.emitter.emit("virtual-scroll", {
                deltaX,
                deltaY,
                event
            });
            if (event.ctrlKey) return;
            if (event.lenisStopPropagation) return;
            const isTouch = event.type.includes("touch");
            const isWheel = event.type.includes("wheel");
            this.isTouching = event.type === "touchstart" || event.type === "touchmove";
            const isClickOrTap = deltaX === 0 && deltaY === 0;
            const isTapToStop = this.options.syncTouch && isTouch && event.type === "touchstart" && isClickOrTap && !this.isStopped && !this.isLocked;
            if (isTapToStop) {
                this.reset();
                return;
            }
            const isUnknownGesture = this.options.gestureOrientation === "vertical" && deltaY === 0 || this.options.gestureOrientation === "horizontal" && deltaX === 0;
            if (isClickOrTap || isUnknownGesture) return;
            let composedPath = event.composedPath();
            composedPath = composedPath.slice(0, composedPath.indexOf(this.rootElement));
            const prevent = this.options.prevent;
            if (!!composedPath.find((node => node instanceof HTMLElement && (typeof prevent === "function" && prevent?.(node) || node.hasAttribute?.("data-lenis-prevent") || isTouch && node.hasAttribute?.("data-lenis-prevent-touch") || isWheel && node.hasAttribute?.("data-lenis-prevent-wheel") || this.options.allowNestedScroll && this.checkNestedScroll(node, {
                deltaX,
                deltaY
            }))))) return;
            if (this.isStopped || this.isLocked) {
                event.preventDefault();
                return;
            }
            const isSmooth = this.options.syncTouch && isTouch || this.options.smoothWheel && isWheel;
            if (!isSmooth) {
                this.isScrolling = "native";
                this.animate.stop();
                event.lenisStopPropagation = true;
                return;
            }
            let delta = deltaY;
            if (this.options.gestureOrientation === "both") delta = Math.abs(deltaY) > Math.abs(deltaX) ? deltaY : deltaX; else if (this.options.gestureOrientation === "horizontal") delta = deltaX;
            if (!this.options.overscroll || this.options.infinite || this.options.wrapper !== window && (this.animatedScroll > 0 && this.animatedScroll < this.limit || this.animatedScroll === 0 && deltaY > 0 || this.animatedScroll === this.limit && deltaY < 0)) event.lenisStopPropagation = true;
            event.preventDefault();
            const isSyncTouch = isTouch && this.options.syncTouch;
            const isTouchEnd = isTouch && event.type === "touchend";
            const hasTouchInertia = isTouchEnd && Math.abs(delta) > 5;
            if (hasTouchInertia) delta = this.velocity * this.options.touchInertiaMultiplier;
            this.scrollTo(this.targetScroll + delta, {
                programmatic: false,
                ...isSyncTouch ? {
                    lerp: hasTouchInertia ? this.options.syncTouchLerp : 1
                } : {
                    lerp: this.options.lerp,
                    duration: this.options.duration,
                    easing: this.options.easing
                }
            });
        };
        resize() {
            this.dimensions.resize();
            this.animatedScroll = this.targetScroll = this.actualScroll;
            this.emit();
        }
        emit() {
            this.emitter.emit("scroll", this);
        }
        onNativeScroll=() => {
            if (this._resetVelocityTimeout !== null) {
                clearTimeout(this._resetVelocityTimeout);
                this._resetVelocityTimeout = null;
            }
            if (this._preventNextNativeScrollEvent) {
                this._preventNextNativeScrollEvent = false;
                return;
            }
            if (this.isScrolling === false || this.isScrolling === "native") {
                const lastScroll = this.animatedScroll;
                this.animatedScroll = this.targetScroll = this.actualScroll;
                this.lastVelocity = this.velocity;
                this.velocity = this.animatedScroll - lastScroll;
                this.direction = Math.sign(this.animatedScroll - lastScroll);
                if (!this.isStopped) this.isScrolling = "native";
                this.emit();
                if (this.velocity !== 0) this._resetVelocityTimeout = setTimeout((() => {
                    this.lastVelocity = this.velocity;
                    this.velocity = 0;
                    this.isScrolling = false;
                    this.emit();
                }), 400);
            }
        };
        reset() {
            this.isLocked = false;
            this.isScrolling = false;
            this.animatedScroll = this.targetScroll = this.actualScroll;
            this.lastVelocity = this.velocity = 0;
            this.animate.stop();
        }
        start() {
            if (!this.isStopped) return;
            this.reset();
            this.isStopped = false;
        }
        stop() {
            if (this.isStopped) return;
            this.reset();
            this.isStopped = true;
        }
        raf=time => {
            const deltaTime = time - (this.time || time);
            this.time = time;
            this.animate.advance(deltaTime * .001);
            if (this.options.autoRaf) this.__rafID = requestAnimationFrame(this.raf);
        };
        scrollTo(target, {offset = 0, immediate = false, lock = false, duration = this.options.duration, easing = this.options.easing, lerp: lerp2 = this.options.lerp, onStart, onComplete, force = false, programmatic = true, userData} = {}) {
            if ((this.isStopped || this.isLocked) && !force) return;
            if (typeof target === "string" && [ "top", "left", "start" ].includes(target)) target = 0; else if (typeof target === "string" && [ "bottom", "right", "end" ].includes(target)) target = this.limit; else {
                let node;
                if (typeof target === "string") node = document.querySelector(target); else if (target instanceof HTMLElement && target?.nodeType) node = target;
                if (node) {
                    if (this.options.wrapper !== window) {
                        const wrapperRect = this.rootElement.getBoundingClientRect();
                        offset -= this.isHorizontal ? wrapperRect.left : wrapperRect.top;
                    }
                    const rect = node.getBoundingClientRect();
                    target = (this.isHorizontal ? rect.left : rect.top) + this.animatedScroll;
                }
            }
            if (typeof target !== "number") return;
            target += offset;
            target = Math.round(target);
            if (this.options.infinite) {
                if (programmatic) {
                    this.targetScroll = this.animatedScroll = this.scroll;
                    const distance = target - this.animatedScroll;
                    if (distance > this.limit / 2) target -= this.limit; else if (distance < -this.limit / 2) target += this.limit;
                }
            } else target = clamp(0, target, this.limit);
            if (target === this.targetScroll) {
                onStart?.(this);
                onComplete?.(this);
                return;
            }
            this.userData = userData ?? {};
            if (immediate) {
                this.animatedScroll = this.targetScroll = target;
                this.setScroll(this.scroll);
                this.reset();
                this.preventNextNativeScrollEvent();
                this.emit();
                onComplete?.(this);
                this.userData = {};
                requestAnimationFrame((() => {
                    this.dispatchScrollendEvent();
                }));
                return;
            }
            if (!programmatic) this.targetScroll = target;
            this.animate.fromTo(this.animatedScroll, target, {
                duration,
                easing,
                lerp: lerp2,
                onStart: () => {
                    if (lock) this.isLocked = true;
                    this.isScrolling = "smooth";
                    onStart?.(this);
                },
                onUpdate: (value, completed) => {
                    this.isScrolling = "smooth";
                    this.lastVelocity = this.velocity;
                    this.velocity = value - this.animatedScroll;
                    this.direction = Math.sign(this.velocity);
                    this.animatedScroll = value;
                    this.setScroll(this.scroll);
                    if (programmatic) this.targetScroll = value;
                    if (!completed) this.emit();
                    if (completed) {
                        this.reset();
                        this.emit();
                        onComplete?.(this);
                        this.userData = {};
                        requestAnimationFrame((() => {
                            this.dispatchScrollendEvent();
                        }));
                        this.preventNextNativeScrollEvent();
                    }
                }
            });
        }
        preventNextNativeScrollEvent() {
            this._preventNextNativeScrollEvent = true;
            requestAnimationFrame((() => {
                this._preventNextNativeScrollEvent = false;
            }));
        }
        checkNestedScroll(node, {deltaX, deltaY}) {
            const time = Date.now();
            const cache = node._lenis ??= {};
            let hasOverflowX, hasOverflowY, isScrollableX, isScrollableY, scrollWidth, scrollHeight, clientWidth, clientHeight;
            const gestureOrientation = this.options.gestureOrientation;
            if (time - (cache.time ?? 0) > 2e3) {
                cache.time = Date.now();
                const computedStyle = window.getComputedStyle(node);
                cache.computedStyle = computedStyle;
                const overflowXString = computedStyle.overflowX;
                const overflowYString = computedStyle.overflowY;
                hasOverflowX = [ "auto", "overlay", "scroll" ].includes(overflowXString);
                hasOverflowY = [ "auto", "overlay", "scroll" ].includes(overflowYString);
                cache.hasOverflowX = hasOverflowX;
                cache.hasOverflowY = hasOverflowY;
                if (!hasOverflowX && !hasOverflowY) return false;
                if (gestureOrientation === "vertical" && !hasOverflowY) return false;
                if (gestureOrientation === "horizontal" && !hasOverflowX) return false;
                scrollWidth = node.scrollWidth;
                scrollHeight = node.scrollHeight;
                clientWidth = node.clientWidth;
                clientHeight = node.clientHeight;
                isScrollableX = scrollWidth > clientWidth;
                isScrollableY = scrollHeight > clientHeight;
                cache.isScrollableX = isScrollableX;
                cache.isScrollableY = isScrollableY;
                cache.scrollWidth = scrollWidth;
                cache.scrollHeight = scrollHeight;
                cache.clientWidth = clientWidth;
                cache.clientHeight = clientHeight;
            } else {
                isScrollableX = cache.isScrollableX;
                isScrollableY = cache.isScrollableY;
                hasOverflowX = cache.hasOverflowX;
                hasOverflowY = cache.hasOverflowY;
                scrollWidth = cache.scrollWidth;
                scrollHeight = cache.scrollHeight;
                clientWidth = cache.clientWidth;
                clientHeight = cache.clientHeight;
            }
            if (!hasOverflowX && !hasOverflowY || !isScrollableX && !isScrollableY) return false;
            if (gestureOrientation === "vertical" && (!hasOverflowY || !isScrollableY)) return false;
            if (gestureOrientation === "horizontal" && (!hasOverflowX || !isScrollableX)) return false;
            let orientation;
            if (gestureOrientation === "horizontal") orientation = "x"; else if (gestureOrientation === "vertical") orientation = "y"; else {
                const isScrollingX = deltaX !== 0;
                const isScrollingY = deltaY !== 0;
                if (isScrollingX && hasOverflowX && isScrollableX) orientation = "x";
                if (isScrollingY && hasOverflowY && isScrollableY) orientation = "y";
            }
            if (!orientation) return false;
            let scroll, maxScroll, delta, hasOverflow, isScrollable;
            if (orientation === "x") {
                scroll = node.scrollLeft;
                maxScroll = scrollWidth - clientWidth;
                delta = deltaX;
                hasOverflow = hasOverflowX;
                isScrollable = isScrollableX;
            } else if (orientation === "y") {
                scroll = node.scrollTop;
                maxScroll = scrollHeight - clientHeight;
                delta = deltaY;
                hasOverflow = hasOverflowY;
                isScrollable = isScrollableY;
            } else return false;
            const willScroll = delta > 0 ? scroll < maxScroll : scroll > 0;
            return willScroll && hasOverflow && isScrollable;
        }
        get rootElement() {
            return this.options.wrapper === window ? document.documentElement : this.options.wrapper;
        }
        get limit() {
            if (this.options.__experimental__naiveDimensions) if (this.isHorizontal) return this.rootElement.scrollWidth - this.rootElement.clientWidth; else return this.rootElement.scrollHeight - this.rootElement.clientHeight; else return this.dimensions.limit[this.isHorizontal ? "x" : "y"];
        }
        get isHorizontal() {
            return this.options.orientation === "horizontal";
        }
        get actualScroll() {
            const wrapper = this.options.wrapper;
            return this.isHorizontal ? wrapper.scrollX ?? wrapper.scrollLeft : wrapper.scrollY ?? wrapper.scrollTop;
        }
        get scroll() {
            return this.options.infinite ? modulo(this.animatedScroll, this.limit) : this.animatedScroll;
        }
        get progress() {
            return this.limit === 0 ? 1 : this.scroll / this.limit;
        }
        get isScrolling() {
            return this._isScrolling;
        }
        set isScrolling(value) {
            if (this._isScrolling !== value) {
                this._isScrolling = value;
                this.updateClassName();
            }
        }
        get isStopped() {
            return this._isStopped;
        }
        set isStopped(value) {
            if (this._isStopped !== value) {
                this._isStopped = value;
                this.updateClassName();
            }
        }
        get isLocked() {
            return this._isLocked;
        }
        set isLocked(value) {
            if (this._isLocked !== value) {
                this._isLocked = value;
                this.updateClassName();
            }
        }
        get isSmooth() {
            return this.isScrolling === "smooth";
        }
        get className() {
            let className = "lenis";
            if (this.options.autoToggle) className += " lenis-autoToggle";
            if (this.isStopped) className += " lenis-stopped";
            if (this.isLocked) className += " lenis-locked";
            if (this.isScrolling) className += " lenis-scrolling";
            if (this.isScrolling === "smooth") className += " lenis-smooth";
            return className;
        }
        updateClassName() {
            this.cleanUpClassName();
            this.rootElement.className = `${this.rootElement.className} ${this.className}`.trim();
        }
        cleanUpClassName() {
            this.rootElement.className = this.rootElement.className.replace(/lenis(-\w+)?/g, "").trim();
        }
    };
    const lenis = new Lenis({
        autoRaf: true
    });
    function isWebp() {
        function testWebP(callback) {
            let webP = new Image;
            webP.onload = webP.onerror = function() {
                callback(webP.height == 2);
            };
            webP.src = "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA";
        }
        testWebP((function(support) {
            let className = support === true ? "webp" : "no-webp";
            document.documentElement.classList.add(className);
        }));
    }
    let _slideUp = (target, duration = 0, showmore = 0) => {
        if (!target.classList.contains("_slide")) {
            target.classList.add("_slide");
            target.style.transitionProperty = "height, margin, padding";
            target.style.transitionDuration = duration + "ms";
            target.style.height = `${target.offsetHeight}px`;
            target.offsetHeight;
            target.style.overflow = "hidden";
            target.style.height = showmore ? `${showmore}px` : `0px`;
            target.style.paddingTop = 0;
            target.style.paddingBottom = 0;
            target.style.marginTop = 0;
            target.style.marginBottom = 0;
            window.setTimeout((() => {
                target.hidden = !showmore ? true : false;
                !showmore ? target.style.removeProperty("height") : null;
                target.style.removeProperty("padding-top");
                target.style.removeProperty("padding-bottom");
                target.style.removeProperty("margin-top");
                target.style.removeProperty("margin-bottom");
                !showmore ? target.style.removeProperty("overflow") : null;
                target.style.removeProperty("transition-duration");
                target.style.removeProperty("transition-property");
                target.classList.remove("_slide");
                document.dispatchEvent(new CustomEvent("slideUpDone", {
                    detail: {
                        target
                    }
                }));
            }), duration);
        }
    };
    let _slideDown = (target, duration = 0, showmore = 0) => {
        if (!target.classList.contains("_slide")) {
            target.classList.add("_slide");
            target.hidden = target.hidden ? false : null;
            showmore ? target.style.removeProperty("height") : null;
            let height = target.offsetHeight;
            target.style.overflow = "hidden";
            target.style.height = showmore ? `${showmore}px` : `0px`;
            target.style.paddingTop = 0;
            target.style.paddingBottom = 0;
            target.style.marginTop = 0;
            target.style.marginBottom = 0;
            target.offsetHeight;
            target.style.transitionProperty = "height, margin, padding";
            target.style.transitionDuration = duration + "ms";
            target.style.height = height + "px";
            target.style.removeProperty("padding-top");
            target.style.removeProperty("padding-bottom");
            target.style.removeProperty("margin-top");
            target.style.removeProperty("margin-bottom");
            window.setTimeout((() => {
                target.style.removeProperty("height");
                target.style.removeProperty("overflow");
                target.style.removeProperty("transition-duration");
                target.style.removeProperty("transition-property");
                target.classList.remove("_slide");
                document.dispatchEvent(new CustomEvent("slideDownDone", {
                    detail: {
                        target
                    }
                }));
            }), duration);
        }
    };
    let bodyLockStatus = true;
    let bodyLockToggle = (delay = 0) => {
        if (document.documentElement.classList.contains("lock")) bodyUnlock(delay); else bodyLock(delay);
    };
    let bodyUnlock = (delay = 0) => {
        let body = document.querySelector("body");
        if (bodyLockStatus) {
            let lock_padding = document.querySelectorAll("[data-lp]");
            setTimeout((() => {
                for (let index = 0; index < lock_padding.length; index++) {
                    const el = lock_padding[index];
                    el.style.paddingRight = "0px";
                }
                body.style.paddingRight = "0px";
                document.documentElement.classList.remove("lock");
                lenis.start();
            }), delay);
            bodyLockStatus = false;
            setTimeout((function() {
                bodyLockStatus = true;
            }), delay);
        }
    };
    let bodyLock = (delay = 0) => {
        let body = document.querySelector("body");
        if (bodyLockStatus) {
            let lock_padding = document.querySelectorAll("[data-lp]");
            for (let index = 0; index < lock_padding.length; index++) {
                const el = lock_padding[index];
                el.style.paddingRight = window.innerWidth - document.querySelector(".wrapper").offsetWidth + "px";
            }
            body.style.paddingRight = window.innerWidth - document.querySelector(".wrapper").offsetWidth + "px";
            document.documentElement.classList.add("lock");
            lenis.stop();
            bodyLockStatus = false;
            setTimeout((function() {
                bodyLockStatus = true;
            }), delay);
        }
    };
    function menuInit() {
        let iconMenu = document.querySelector(".icon-menu");
        let menuBody = document.querySelector(".menu__body");
        if (iconMenu) document.addEventListener("click", (function(e) {
            if (bodyLockStatus && e.target.closest(".icon-menu")) {
                document.documentElement.classList.toggle("menu-open");
                bodyLockToggle();
            }
            if (document.documentElement.classList.contains("menu-open")) if (!iconMenu.contains(e.target) && !menuBody.contains(e.target)) {
                document.documentElement.classList.remove("menu-open");
                bodyUnlock();
            }
        }));
    }
    function showMore() {
        window.addEventListener("load", (function(e) {
            const showMoreBlocks = document.querySelectorAll("[data-showmore]");
            let showMoreBlocksRegular;
            let mdQueriesArray;
            if (showMoreBlocks.length) {
                showMoreBlocksRegular = Array.from(showMoreBlocks).filter((function(item, index, self) {
                    return !item.dataset.showmoreMedia;
                }));
                showMoreBlocksRegular.length ? initItems(showMoreBlocksRegular) : null;
                document.addEventListener("click", showMoreActions);
                mdQueriesArray = dataMediaQueries(showMoreBlocks, "showmoreMedia");
                if (mdQueriesArray && mdQueriesArray.length) {
                    mdQueriesArray.forEach((mdQueriesItem => {
                        mdQueriesItem.matchMedia.addEventListener("change", (function() {
                            initItems(mdQueriesItem.itemsArray, mdQueriesItem.matchMedia);
                        }));
                    }));
                    initItemsMedia(mdQueriesArray);
                }
            }
            function initItemsMedia(mdQueriesArray) {
                mdQueriesArray.forEach((mdQueriesItem => {
                    initItems(mdQueriesItem.itemsArray, mdQueriesItem.matchMedia);
                }));
            }
            function initItems(showMoreBlocks, matchMedia) {
                showMoreBlocks.forEach((showMoreBlock => {
                    initItem(showMoreBlock, matchMedia);
                }));
            }
            function initItem(showMoreBlock, matchMedia = false) {
                showMoreBlock = matchMedia ? showMoreBlock.item : showMoreBlock;
                let showMoreContent = showMoreBlock.querySelectorAll("[data-showmore-content]");
                let showMoreButton = showMoreBlock.querySelectorAll("[data-showmore-button]");
                showMoreContent = Array.from(showMoreContent).filter((item => item.closest("[data-showmore]") === showMoreBlock))[0];
                showMoreButton = Array.from(showMoreButton).filter((item => item.closest("[data-showmore]") === showMoreBlock))[0];
                const hiddenHeight = getHeight(showMoreBlock, showMoreContent);
                if (matchMedia.matches || !matchMedia) if (hiddenHeight < getOriginalHeight(showMoreContent)) {
                    _slideUp(showMoreContent, 0, hiddenHeight);
                    showMoreButton.hidden = false;
                } else {
                    _slideDown(showMoreContent, 0, hiddenHeight);
                    showMoreButton.hidden = true;
                } else {
                    _slideDown(showMoreContent, 0, hiddenHeight);
                    showMoreButton.hidden = true;
                }
            }
            function getHeight(showMoreBlock, showMoreContent) {
                let hiddenHeight = 0;
                const showMoreType = showMoreBlock.dataset.showmore ? showMoreBlock.dataset.showmore : "size";
                if (showMoreType === "items") {
                    const showMoreTypeValue = showMoreContent.dataset.showmoreContent ? showMoreContent.dataset.showmoreContent : 3;
                    const showMoreItems = showMoreContent.children;
                    for (let index = 1; index < showMoreItems.length; index++) {
                        const showMoreItem = showMoreItems[index - 1];
                        hiddenHeight += showMoreItem.offsetHeight + 20;
                        if (index == showMoreTypeValue) break;
                    }
                } else {
                    const showMoreTypeValue = showMoreContent.dataset.showmoreContent ? showMoreContent.dataset.showmoreContent : 150;
                    hiddenHeight = showMoreTypeValue;
                }
                return hiddenHeight;
            }
            function getOriginalHeight(showMoreContent) {
                let parentHidden;
                let hiddenHeight = showMoreContent.offsetHeight;
                showMoreContent.style.removeProperty("height");
                if (showMoreContent.closest(`[hidden]`)) {
                    parentHidden = showMoreContent.closest(`[hidden]`);
                    parentHidden.hidden = false;
                }
                let originalHeight = showMoreContent.offsetHeight;
                parentHidden ? parentHidden.hidden = true : null;
                showMoreContent.style.height = `${hiddenHeight}px`;
                return originalHeight;
            }
            function showMoreActions(e) {
                const targetEvent = e.target;
                const targetType = e.type;
                if (targetType === "click") {
                    if (targetEvent.closest("[data-showmore-button]")) {
                        const showMoreButton = targetEvent.closest("[data-showmore-button]");
                        const showMoreBlock = showMoreButton.closest("[data-showmore]");
                        const showMoreContent = showMoreBlock.querySelector("[data-showmore-content]");
                        const showMoreSpeed = showMoreBlock.dataset.showmoreButton ? showMoreBlock.dataset.showmoreButton : "500";
                        const hiddenHeight = getHeight(showMoreBlock, showMoreContent);
                        if (!showMoreContent.classList.contains("_slide")) {
                            showMoreBlock.classList.contains("_showmore-active") ? _slideUp(showMoreContent, showMoreSpeed, hiddenHeight) : _slideDown(showMoreContent, showMoreSpeed, hiddenHeight);
                            showMoreBlock.classList.toggle("_showmore-active");
                        }
                    }
                } else if (targetType === "resize") {
                    showMoreBlocksRegular && showMoreBlocksRegular.length ? initItems(showMoreBlocksRegular) : null;
                    mdQueriesArray && mdQueriesArray.length ? initItemsMedia(mdQueriesArray) : null;
                }
            }
        }));
    }
    function uniqArray(array) {
        return array.filter((function(item, index, self) {
            return self.indexOf(item) === index;
        }));
    }
    function dataMediaQueries(array, dataSetValue) {
        const media = Array.from(array).filter((function(item, index, self) {
            if (item.dataset[dataSetValue]) return item.dataset[dataSetValue].split(",")[0];
        }));
        if (media.length) {
            const breakpointsArray = [];
            media.forEach((item => {
                const params = item.dataset[dataSetValue];
                const breakpoint = {};
                const paramsArray = params.split(",");
                breakpoint.value = paramsArray[0];
                breakpoint.type = paramsArray[1] ? paramsArray[1].trim() : "max";
                breakpoint.item = item;
                breakpointsArray.push(breakpoint);
            }));
            let mdQueries = breakpointsArray.map((function(item) {
                return "(" + item.type + "-width: " + item.value + "px)," + item.value + "," + item.type;
            }));
            mdQueries = uniqArray(mdQueries);
            const mdQueriesArray = [];
            if (mdQueries.length) {
                mdQueries.forEach((breakpoint => {
                    const paramsArray = breakpoint.split(",");
                    const mediaBreakpoint = paramsArray[1];
                    const mediaType = paramsArray[2];
                    const matchMedia = window.matchMedia(paramsArray[0]);
                    const itemsArray = breakpointsArray.filter((function(item) {
                        if (item.value === mediaBreakpoint && item.type === mediaType) return true;
                    }));
                    mdQueriesArray.push({
                        itemsArray,
                        matchMedia
                    });
                }));
                return mdQueriesArray;
            }
        }
    }
    let addWindowScrollEvent = false;
    setTimeout((() => {
        if (addWindowScrollEvent) {
            let windowScroll = new Event("windowScroll");
            window.addEventListener("scroll", (function(e) {
                document.dispatchEvent(windowScroll);
            }));
        }
    }), 0);
    function DynamicAdapt(type) {
        this.type = type;
    }
    DynamicAdapt.prototype.init = function() {
        const _this = this;
        this.оbjects = [];
        this.daClassname = "_dynamic_adapt_";
        this.nodes = document.querySelectorAll("[data-da]");
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const data = node.dataset.da.trim();
            const dataArray = data.split(",");
            const оbject = {};
            оbject.element = node;
            оbject.parent = node.parentNode;
            оbject.destination = document.querySelector(dataArray[0].trim());
            оbject.breakpoint = dataArray[1] ? dataArray[1].trim() : "767";
            оbject.place = dataArray[2] ? dataArray[2].trim() : "last";
            оbject.index = this.indexInParent(оbject.parent, оbject.element);
            this.оbjects.push(оbject);
        }
        this.arraySort(this.оbjects);
        this.mediaQueries = Array.prototype.map.call(this.оbjects, (function(item) {
            return "(" + this.type + "-width: " + item.breakpoint + "px)," + item.breakpoint;
        }), this);
        this.mediaQueries = Array.prototype.filter.call(this.mediaQueries, (function(item, index, self) {
            return Array.prototype.indexOf.call(self, item) === index;
        }));
        for (let i = 0; i < this.mediaQueries.length; i++) {
            const media = this.mediaQueries[i];
            const mediaSplit = String.prototype.split.call(media, ",");
            const matchMedia = window.matchMedia(mediaSplit[0]);
            const mediaBreakpoint = mediaSplit[1];
            const оbjectsFilter = Array.prototype.filter.call(this.оbjects, (function(item) {
                return item.breakpoint === mediaBreakpoint;
            }));
            matchMedia.addListener((function() {
                _this.mediaHandler(matchMedia, оbjectsFilter);
            }));
            this.mediaHandler(matchMedia, оbjectsFilter);
        }
    };
    DynamicAdapt.prototype.mediaHandler = function(matchMedia, оbjects) {
        if (matchMedia.matches) for (let i = 0; i < оbjects.length; i++) {
            const оbject = оbjects[i];
            оbject.index = this.indexInParent(оbject.parent, оbject.element);
            this.moveTo(оbject.place, оbject.element, оbject.destination);
        } else for (let i = оbjects.length - 1; i >= 0; i--) {
            const оbject = оbjects[i];
            if (оbject.element.classList.contains(this.daClassname)) this.moveBack(оbject.parent, оbject.element, оbject.index);
        }
    };
    DynamicAdapt.prototype.moveTo = function(place, element, destination) {
        element.classList.add(this.daClassname);
        if (place === "last" || place >= destination.children.length) {
            destination.insertAdjacentElement("beforeend", element);
            return;
        }
        if (place === "first") {
            destination.insertAdjacentElement("afterbegin", element);
            return;
        }
        destination.children[place].insertAdjacentElement("beforebegin", element);
    };
    DynamicAdapt.prototype.moveBack = function(parent, element, index) {
        element.classList.remove(this.daClassname);
        if (parent.children[index] !== void 0) parent.children[index].insertAdjacentElement("beforebegin", element); else parent.insertAdjacentElement("beforeend", element);
    };
    DynamicAdapt.prototype.indexInParent = function(parent, element) {
        const array = Array.prototype.slice.call(parent.children);
        return Array.prototype.indexOf.call(array, element);
    };
    DynamicAdapt.prototype.arraySort = function(arr) {
        if (this.type === "min") Array.prototype.sort.call(arr, (function(a, b) {
            if (a.breakpoint === b.breakpoint) {
                if (a.place === b.place) return 0;
                if (a.place === "first" || b.place === "last") return -1;
                if (a.place === "last" || b.place === "first") return 1;
                return a.place - b.place;
            }
            return a.breakpoint - b.breakpoint;
        })); else {
            Array.prototype.sort.call(arr, (function(a, b) {
                if (a.breakpoint === b.breakpoint) {
                    if (a.place === b.place) return 0;
                    if (a.place === "first" || b.place === "last") return 1;
                    if (a.place === "last" || b.place === "first") return -1;
                    return b.place - a.place;
                }
                return b.breakpoint - a.breakpoint;
            }));
            return;
        }
    };
    const da = new DynamicAdapt("max");
    da.init();
    isWebp();
    menuInit();
    showMore();
})();