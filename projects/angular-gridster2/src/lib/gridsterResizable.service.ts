import { NgZone } from '@angular/core';
import { GridsterComponentInterface } from './gridster.interface';
import { DirTypes } from './gridsterConfig.interface';
import { GridsterItemComponentInterface } from './gridsterItem.interface';
import { GridsterPush } from './gridsterPush.service';
import { GridsterPushResize } from './gridsterPushResize.service';
import { GridsterResizeEventType } from './gridsterResizeEventType.interface';
import { cancelScroll, scroll } from './gridsterScroll.service';
import { GridsterUtils } from './gridsterUtils.service';
import { GridsterComponent } from './gridster.component';

export class GridsterResizable {
  gridsterItem: GridsterItemComponentInterface;
  gridster: GridsterComponentInterface;
  lastMouse: {
    clientX: number;
    clientY: number;
  };
  itemBackup: number[];
  resizeEventScrollType: GridsterResizeEventType;

  /**
   * The direction function may reference any of the `GridsterResizable` class methods, that are
   * responsible for gridster resize when the `dragmove` event is being handled. E.g. it may reference
   * the `handleNorth` method when the north handle is pressed and moved by a mouse.
   */
  private directionFunction:
    | ((event: Pick<MouseEvent, 'clientX' | 'clientY'>) => void)
    | null = null;

  resizeEnabled: boolean;
  resizableHandles?: {
    s: boolean;
    e: boolean;
    n: boolean;
    w: boolean;
    se: boolean;
    ne: boolean;
    sw: boolean;
    nw: boolean;
  };
  mousemove: () => void;
  mouseup: () => void;
  mouseleave: () => void;
  cancelOnBlur: () => void;
  touchmove: () => void;
  touchend: () => void;
  touchcancel: () => void;
  push: GridsterPush;
  pushResize: GridsterPushResize;
  minHeight: number;
  minWidth: number;
  offsetTop: number;
  offsetLeft: number;
  diffTop: number;
  diffLeft: number;
  diffRight: number;
  diffBottom: number;
  margin: number;
  outerMarginTop: number | null;
  outerMarginRight: number | null;
  outerMarginBottom: number | null;
  outerMarginLeft: number | null;
  originalClientX: number;
  originalClientY: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
  newPosition: number;
  // private scalerLineRef: HTMLDivElement | null = null;
  private scalerLineRefs: HTMLDivElement[] = [];
  private isDragging: boolean = false;
  private topMatched: boolean = false;
  private bottomMatched: boolean = false;
  private leftMatched: boolean = false;
  private rightMatched: boolean = false;

  constructor(
    gridsterItem: GridsterItemComponentInterface,
    gridster: GridsterComponentInterface,
    private zone: NgZone
  ) {
    this.gridsterItem = gridsterItem;
    this.gridster = gridster;
    this.lastMouse = {
      clientX: 0,
      clientY: 0
    };
    this.itemBackup = [0, 0, 0, 0];
    this.resizeEventScrollType = {
      west: false,
      east: false,
      north: false,
      south: false
    };
  }

  destroy(): void {
    this.gridster?.previewStyle();
    this.gridster = this.gridsterItem = null!;
  }

  showScalerLine(item: GridsterItemComponentInterface): void {
    if (!this.isDragging) return;
    const rect = item.el.getBoundingClientRect();

    let matchedLeftItem: GridsterItemComponentInterface | null = null;
    let matchedRightItem: GridsterItemComponentInterface | null = null;
    let matchedTopItem: GridsterItemComponentInterface | null = null;
    let matchedBottomItem: GridsterItemComponentInterface | null = null;

    (this.gridster as GridsterComponent).grid.forEach(otherItem => {
      if (otherItem === item) return;

      const otherRect = otherItem.el.getBoundingClientRect();
      const tolerance = 2;

      if (Math.abs(otherRect.bottom - rect.top) < tolerance) {
        this.topMatched = true;
        matchedTopItem = otherItem;
      }

      if (Math.abs(otherRect.top - rect.bottom) < tolerance) {
        this.bottomMatched = true;
        matchedBottomItem = otherItem;
      }

      if (Math.abs(otherRect.top - rect.top) < tolerance) {
        this.topMatched = true;
        matchedTopItem = otherItem;
      }

      if (Math.abs(otherRect.bottom - rect.bottom) < tolerance) {
        this.bottomMatched = true;
        matchedBottomItem = otherItem;
      }

      if (Math.abs(otherRect.left - rect.left) < tolerance) {
        this.leftMatched = true;
        matchedLeftItem = otherItem;
      }

      if (Math.abs(otherRect.right - rect.right) < tolerance) {
        this.rightMatched = true;
        matchedRightItem = otherItem;
      }
    });

    if (this.scalerLineRefs && this.scalerLineRefs.length) {
      this.scalerLineRefs.forEach(line => document.body.removeChild(line));
    }
    this.scalerLineRefs = [];

    const createLine = (styles: Partial<CSSStyleDeclaration>) => {
      const line = document.createElement('div');
      line.style.position = 'absolute';
      Object.assign(line.style, styles);
      document.body.appendChild(line);
      this.scalerLineRefs.push(line);
    };

    if (this.topMatched && matchedTopItem) {
      const otherRect = (
        matchedTopItem as GridsterItemComponentInterface
      ).el.getBoundingClientRect();
      const gridRect = (
        this.gridster as GridsterComponent
      ).el.getBoundingClientRect();
      const width = gridRect.width; // Full width of the grid
      const left = gridRect.left; // Start from left edge of the grid
      const top = rect.top; // Line aligned to top of the current item

      createLine({
        height: '2px',
        width: `${width}px`,
        left: `${left}px`,
        top: `${top}px`,
        borderTop: '2px dashed blue',
        background: 'transparent'
      });
    }

    if (this.bottomMatched && matchedBottomItem) {
      const otherRect = (
        matchedBottomItem as GridsterItemComponentInterface
      ).el.getBoundingClientRect();
      const gridRect = (
        this.gridster as GridsterComponent
      ).el.getBoundingClientRect();

      const width = gridRect.width; // Full width of the grid
      const left = gridRect.left; // Start at leftmost point of grid
      const top = rect.bottom; // Line at the bottom of the current item

      createLine({
        height: '2px',
        width: `${width}px`,
        left: `${left}px`,
        top: `${top}px`,
        borderTop: '2px dashed blue',
        background: 'transparent'
      });
    }

    if (this.leftMatched && matchedLeftItem) {
      const otherRect = (
        matchedLeftItem as GridsterItemComponentInterface
      ).el.getBoundingClientRect();
      const gridRect = (
        this.gridster as GridsterComponent
      ).el.getBoundingClientRect();

      const height = gridRect.height; // Full height of the grid
      const top = gridRect.top; // Start from top of the grid

      createLine({
        width: '2px',
        height: `${height}px`,
        left: `${rect.left}px`, // Line at left edge of current item
        top: `${top}px`, // Start from top of grid
        borderLeft: '2px dashed blue',
        background: 'transparent'
      });
    }

    if (this.rightMatched && matchedRightItem) {
      const otherRect = (
        matchedRightItem as GridsterItemComponentInterface
      ).el.getBoundingClientRect();
      const gridRect = (
        this.gridster as GridsterComponent
      ).el.getBoundingClientRect();

      const height = gridRect.height; // Full height of the grid
      const top = gridRect.top; // Top of the grid

      createLine({
        width: '2px',
        height: `${height}px`,
        left: `${rect.right}px`, // Right edge of the current item
        top: `${top}px`, // Start from grid top
        borderLeft: '2px dashed blue',
        background: 'transparent'
      });
    }

    this.topMatched = false;
    this.bottomMatched = false;
    this.leftMatched = false;
    this.rightMatched = false;
  }

  dragStart(e: MouseEvent): void {
    if (e.which && e.which !== 1) {
      return;
    }
    if (
      this.gridster.options.resizable &&
      this.gridster.options.resizable.start
    ) {
      this.gridster.options.resizable.start(
        this.gridsterItem.item,
        this.gridsterItem,
        e
      );
    }
    e.stopPropagation();
    e.preventDefault();

    this.zone.runOutsideAngular(() => {
      this.mousemove = this.gridsterItem.renderer.listen(
        'document',
        'mousemove',
        this.dragMove
      );
      this.touchmove = this.gridster.renderer.listen(
        this.gridster.el,
        'touchmove',
        this.dragMove
      );
    });
    this.mouseup = this.gridsterItem.renderer.listen(
      'document',
      'mouseup',
      this.dragStop
    );
    this.mouseleave = this.gridsterItem.renderer.listen(
      'document',
      'mouseleave',
      this.dragStop
    );
    this.cancelOnBlur = this.gridsterItem.renderer.listen(
      'window',
      'blur',
      this.dragStop
    );
    this.touchend = this.gridsterItem.renderer.listen(
      'document',
      'touchend',
      this.dragStop
    );
    this.touchcancel = this.gridsterItem.renderer.listen(
      'document',
      'touchcancel',
      this.dragStop
    );

    this.gridsterItem.renderer.addClass(
      this.gridsterItem.el,
      'gridster-item-resizing'
    );
    this.lastMouse.clientX = e.clientX;
    this.lastMouse.clientY = e.clientY;
    this.left = this.gridsterItem.left;
    this.top = this.gridsterItem.top;
    this.originalClientX = e.clientX;
    this.originalClientY = e.clientY;
    this.width = this.gridsterItem.width;
    this.height = this.gridsterItem.height;
    this.bottom = this.gridsterItem.top + this.gridsterItem.height;
    this.right = this.gridsterItem.left + this.gridsterItem.width;
    this.margin = this.gridster.$options.margin;
    this.outerMarginTop = this.gridster.$options.outerMarginTop;
    this.outerMarginRight = this.gridster.$options.outerMarginRight;
    this.outerMarginBottom = this.gridster.$options.outerMarginBottom;
    this.outerMarginLeft = this.gridster.$options.outerMarginLeft;
    this.offsetLeft = this.gridster.el.scrollLeft - this.gridster.el.offsetLeft;
    this.offsetTop = this.gridster.el.scrollTop - this.gridster.el.offsetTop;
    this.diffLeft = e.clientX + this.offsetLeft - this.left;
    this.diffRight = e.clientX + this.offsetLeft - this.right;
    this.diffTop = e.clientY + this.offsetTop - this.top;
    this.diffBottom = e.clientY + this.offsetTop - this.bottom;
    this.minHeight =
      this.gridster.positionYToPixels(
        this.gridsterItem.$item.minItemRows ||
          this.gridster.$options.minItemRows
      ) - this.margin;
    this.minWidth =
      this.gridster.positionXToPixels(
        this.gridsterItem.$item.minItemCols ||
          this.gridster.$options.minItemCols
      ) - this.margin;
    this.gridster.movingItem = this.gridsterItem.$item;
    this.gridster.previewStyle();
    this.push = new GridsterPush(this.gridsterItem);
    this.pushResize = new GridsterPushResize(this.gridsterItem);
    this.gridster.dragInProgress = true;
    this.gridster.updateGrid();

    const { classList } = e.target as HTMLElement;

    if (classList.contains('handle-n')) {
      this.resizeEventScrollType.north = true;
      this.directionFunction = this.handleNorth;
    } else if (classList.contains('handle-w')) {
      if (this.gridster.$options.dirType === DirTypes.RTL) {
        this.resizeEventScrollType.east = true;
        this.directionFunction = this.handleEast;
      } else {
        this.resizeEventScrollType.west = true;
        this.directionFunction = this.handleWest;
      }
    } else if (classList.contains('handle-s')) {
      this.resizeEventScrollType.south = true;
      this.directionFunction = this.handleSouth;
    } else if (classList.contains('handle-e')) {
      if (this.gridster.$options.dirType === DirTypes.RTL) {
        this.resizeEventScrollType.west = true;
        this.directionFunction = this.handleWest;
      } else {
        this.resizeEventScrollType.east = true;
        this.directionFunction = this.handleEast;
      }
    } else if (classList.contains('handle-nw')) {
      if (this.gridster.$options.dirType === DirTypes.RTL) {
        this.resizeEventScrollType.north = true;
        this.resizeEventScrollType.east = true;
        this.directionFunction = this.handleNorthEast;
      } else {
        this.resizeEventScrollType.north = true;
        this.resizeEventScrollType.west = true;
        this.directionFunction = this.handleNorthWest;
      }
    } else if (classList.contains('handle-ne')) {
      if (this.gridster.$options.dirType === DirTypes.RTL) {
        this.resizeEventScrollType.north = true;
        this.resizeEventScrollType.west = true;
        this.directionFunction = this.handleNorthWest;
      } else {
        this.resizeEventScrollType.north = true;
        this.resizeEventScrollType.east = true;
        this.directionFunction = this.handleNorthEast;
      }
    } else if (classList.contains('handle-sw')) {
      if (this.gridster.$options.dirType === DirTypes.RTL) {
        this.resizeEventScrollType.south = true;
        this.resizeEventScrollType.east = true;
        this.directionFunction = this.handleSouthEast;
      } else {
        this.resizeEventScrollType.south = true;
        this.resizeEventScrollType.west = true;
        this.directionFunction = this.handleSouthWest;
      }
    } else if (classList.contains('handle-se')) {
      if (this.gridster.$options.dirType === DirTypes.RTL) {
        this.resizeEventScrollType.south = true;
        this.resizeEventScrollType.west = true;
        this.directionFunction = this.handleSouthWest;
      } else {
        this.resizeEventScrollType.south = true;
        this.resizeEventScrollType.east = true;
        this.directionFunction = this.handleSouthEast;
      }
    }
  }

  dragMove = (e: MouseEvent): void => {
    if (this.directionFunction === null) {
      throw new Error(
        'The `directionFunction` has not been set before calling `dragMove`.'
      );
    }

    e.stopPropagation();
    e.preventDefault();
    GridsterUtils.checkTouchEvent(e);
    this.offsetTop = this.gridster.el.scrollTop - this.gridster.el.offsetTop;
    this.offsetLeft = this.gridster.el.scrollLeft - this.gridster.el.offsetLeft;
    scroll(
      this.gridster,
      this.left,
      this.top,
      this.width,
      this.height,
      e,
      this.lastMouse,
      this.directionFunction,
      true,
      this.resizeEventScrollType
    );

    const scale = this.gridster.options.scale || 1;
    this.directionFunction({
      clientX:
        this.originalClientX + (e.clientX - this.originalClientX) / scale,
      clientY: this.originalClientY + (e.clientY - this.originalClientY) / scale
    });

    this.lastMouse.clientX = e.clientX;
    this.lastMouse.clientY = e.clientY;
    this.zone.run(() => {
      this.gridster.updateGrid();
    });

    // console.log('✅ dragMove called');
    this.isDragging = true;

    this.showScalerLine(this.gridsterItem);
    // console.log("direction", this.resizeEventScrollType);
    this.resizeEventScrollType = {
      west: false,
      east: false,
      north: false,
      south: false
    };
    this.topMatched = false;
    this.bottomMatched = false;
    this.leftMatched = false;

    this.rightMatched = false;
  };

  dragStop = (e: MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    cancelScroll();
    this.mousemove();
    this.mouseup();
    this.mouseleave();
    this.cancelOnBlur();
    this.touchmove();
    this.touchend();
    this.touchcancel();
    this.gridster.dragInProgress = false;
    this.gridster.updateGrid();
    if (
      this.gridster.options.resizable &&
      this.gridster.options.resizable.stop
    ) {
      Promise.resolve(
        this.gridster.options.resizable.stop(
          this.gridsterItem.item,
          this.gridsterItem,
          e
        )
      ).then(this.makeResize, this.cancelResize);
    } else {
      this.makeResize();
    }
    setTimeout(() => {
      this.gridsterItem.renderer.removeClass(
        this.gridsterItem.el,
        'gridster-item-resizing'
      );
      if (this.gridster) {
        this.gridster.movingItem = null;
        this.gridster.previewStyle();
      }
    });

    this.isDragging = false;
    if (this.scalerLineRefs && this.scalerLineRefs.length) {
      this.scalerLineRefs.forEach(line => {
        if (line && line.parentNode) {
          line.parentNode.removeChild(line);
        }
      });
      this.scalerLineRefs = [];
    }
  };

  cancelResize = (): void => {
    this.gridsterItem.$item.cols = this.gridsterItem.item.cols || 1;
    this.gridsterItem.$item.rows = this.gridsterItem.item.rows || 1;
    this.gridsterItem.$item.x = this.gridsterItem.item.x || 0;
    this.gridsterItem.$item.y = this.gridsterItem.item.y || 0;
    this.gridsterItem.setSize();
    this.push.restoreItems();
    this.pushResize.restoreItems();
    this.push.destroy();
    this.push = null!;
    this.pushResize.destroy();
    this.pushResize = null!;
  };

  makeResize = (): void => {
    this.gridsterItem.setSize();
    this.gridsterItem.checkItemChanges(
      this.gridsterItem.$item,
      this.gridsterItem.item
    );
    this.push.setPushedItems();
    this.pushResize.setPushedItems();
    this.push.destroy();
    this.push = null!;
    this.pushResize.destroy();
    this.pushResize = null!;
  };

  private handleNorth = (e: MouseEvent, doChecks = true): void => {
    this.top = e.clientY + this.offsetTop - this.diffTop;
    this.height = this.bottom - this.top;
    if (this.minHeight > this.height) {
      this.height = this.minHeight;
      this.top = this.bottom - this.minHeight;
    } else if (this.gridster.options.enableBoundaryControl) {
      this.top = Math.max(0, this.top);
      this.height = this.bottom - this.top;
    }
    const marginTop = this.gridster.options.pushItems ? this.margin : 0;
    this.newPosition = this.gridster.pixelsToPositionY(
      this.top + marginTop,
      Math.floor
    );
    if (this.gridsterItem.$item.y !== this.newPosition) {
      this.itemBackup[1] = this.gridsterItem.$item.y;
      this.itemBackup[3] = this.gridsterItem.$item.rows;
      this.gridsterItem.$item.rows +=
        this.gridsterItem.$item.y - this.newPosition;
      this.gridsterItem.$item.y = this.newPosition;
      this.pushResize.pushItems(this.pushResize.fromSouth);
      this.push.pushItems(
        this.push.fromSouth,
        this.gridster.$options.disablePushOnResize
      );
      if (!doChecks) {
        return;
      }
      if (this.gridster.checkCollision(this.gridsterItem.$item, true)) {
        this.resetNorth();
        return;
      }
      this.gridster.previewStyle();
      this.pushResize.checkPushBack();
      this.push.checkPushBack();
    }
    this.setItemTop(this.top);
    this.setItemHeight(this.height);
  };

  private handleWest = (e: MouseEvent, doChecks = true): void => {
    const clientX =
      this.gridster.$options.dirType === DirTypes.RTL
        ? this.originalClientX + (this.originalClientX - e.clientX)
        : e.clientX;
    this.left = clientX + this.offsetLeft - this.diffLeft;

    this.width = this.right - this.left;
    if (this.minWidth > this.width) {
      this.width = this.minWidth;
      this.left = this.right - this.minWidth;
    } else if (this.gridster.options.enableBoundaryControl) {
      this.left = Math.max(0, this.left);
      this.width = this.right - this.left;
    }
    const marginLeft = this.gridster.options.pushItems ? this.margin : 0;
    this.newPosition = this.gridster.pixelsToPositionX(
      this.left + marginLeft,
      Math.floor
    );
    if (this.gridsterItem.$item.x !== this.newPosition) {
      this.itemBackup[0] = this.gridsterItem.$item.x;
      this.itemBackup[2] = this.gridsterItem.$item.cols;
      this.gridsterItem.$item.cols +=
        this.gridsterItem.$item.x - this.newPosition;
      this.gridsterItem.$item.x = this.newPosition;
      this.pushResize.pushItems(this.pushResize.fromEast);
      this.push.pushItems(
        this.push.fromEast,
        this.gridster.$options.disablePushOnResize
      );
      if (!doChecks) {
        return;
      }
      if (this.gridster.checkCollision(this.gridsterItem.$item, true)) {
        this.resetWest();
        return;
      }
      this.gridster.previewStyle();
      this.pushResize.checkPushBack();
      this.push.checkPushBack();
    }
    this.setItemLeft(this.left);
    this.setItemWidth(this.width);
  };

  private handleSouth = (e: MouseEvent, doChecks = true): void => {
    this.height = e.clientY + this.offsetTop - this.diffBottom - this.top;
    if (this.minHeight > this.height) {
      this.height = this.minHeight;
    }
    this.bottom = this.top + this.height;
    if (this.gridster.options.enableBoundaryControl) {
      const margin = this.outerMarginBottom ?? this.margin;
      const box = this.gridster.el.getBoundingClientRect();
      this.bottom = Math.min(this.bottom, box.bottom - box.top - 2 * margin);
      this.height = this.bottom - this.top;
    }
    const marginBottom = this.gridster.options.pushItems ? 0 : this.margin;
    this.newPosition = this.gridster.pixelsToPositionY(
      this.bottom + marginBottom,
      Math.ceil
    );
    if (
      this.gridsterItem.$item.y + this.gridsterItem.$item.rows !==
      this.newPosition
    ) {
      this.itemBackup[3] = this.gridsterItem.$item.rows;
      this.gridsterItem.$item.rows =
        this.newPosition - this.gridsterItem.$item.y;
      this.pushResize.pushItems(this.pushResize.fromNorth);
      this.push.pushItems(
        this.push.fromNorth,
        this.gridster.$options.disablePushOnResize
      );
      if (!doChecks) {
        return;
      }
      if (this.gridster.checkCollision(this.gridsterItem.$item, true)) {
        this.resetSouth();
        return;
      }
      this.gridster.previewStyle();
      this.pushResize.checkPushBack();
      this.push.checkPushBack();
    }
    this.setItemHeight(this.height);
  };

  private handleEast = (e: MouseEvent, doChecks = true): void => {
    const clientX =
      this.gridster.$options.dirType === DirTypes.RTL
        ? this.originalClientX + (this.originalClientX - e.clientX)
        : e.clientX;
    this.width = clientX + this.offsetLeft - this.diffRight - this.left;

    if (this.minWidth > this.width) {
      this.width = this.minWidth;
    }
    this.right = this.left + this.width;
    if (this.gridster.options.enableBoundaryControl) {
      const margin = this.outerMarginRight ?? this.margin;
      const box = this.gridster.el.getBoundingClientRect();
      this.right = Math.min(this.right, box.right - box.left - 2 * margin);
      this.width = this.right - this.left;
    }
    const marginRight = this.gridster.options.pushItems ? 0 : this.margin;
    this.newPosition = this.gridster.pixelsToPositionX(
      this.right + marginRight,
      Math.ceil
    );
    if (
      this.gridsterItem.$item.x + this.gridsterItem.$item.cols !==
      this.newPosition
    ) {
      this.itemBackup[2] = this.gridsterItem.$item.cols;
      this.gridsterItem.$item.cols =
        this.newPosition - this.gridsterItem.$item.x;
      this.pushResize.pushItems(this.pushResize.fromWest);
      this.push.pushItems(
        this.push.fromWest,
        this.gridster.$options.disablePushOnResize
      );
      if (!doChecks) {
        return;
      }
      if (this.gridster.checkCollision(this.gridsterItem.$item, true)) {
        this.resetEast();
        return;
      }
      this.gridster.previewStyle();
      this.pushResize.checkPushBack();
      this.push.checkPushBack();
    }
    this.setItemWidth(this.width);
  };

  private handleNorthWest = (e: MouseEvent): void => {
    this.handleNorth(e, false);
    this.handleWest(e, false);
    const hasRatio = !!(
      this.gridster.$options.itemAspectRatio ||
      this.gridsterItem.$item.itemAspectRatio
    );
    if (hasRatio) {
      this.setItemTop(this.top);
      this.setItemHeight(this.height);
      this.setItemLeft(this.left);
      this.setItemWidth(this.width);
    }
    if (this.gridster.checkCollision(this.gridsterItem.$item, true)) {
      this.resetNorth(hasRatio);
      this.resetWest(hasRatio);
      return;
    }
    this.gridster.previewStyle();
    this.pushResize.checkPushBack();
    this.push.checkPushBack();
  };

  private handleNorthEast = (e: MouseEvent): void => {
    this.handleNorth(e, false);
    this.handleEast(e, false);
    const hasRatio = !!(
      this.gridster.$options.itemAspectRatio ||
      this.gridsterItem.$item.itemAspectRatio
    );
    if (hasRatio) {
      this.setItemTop(this.top);
      this.setItemHeight(this.height);
      this.setItemWidth(this.width);
    }
    if (this.gridster.checkCollision(this.gridsterItem.$item, true)) {
      this.resetNorth(hasRatio);
      this.resetEast(hasRatio);
      return;
    }
    this.gridster.previewStyle();
    this.pushResize.checkPushBack();
    this.push.checkPushBack();
  };

  private handleSouthWest = (e: MouseEvent): void => {
    this.handleSouth(e, false);
    this.handleWest(e, false);
    const hasRatio = !!(
      this.gridster.$options.itemAspectRatio ||
      this.gridsterItem.$item.itemAspectRatio
    );
    if (hasRatio) {
      this.setItemLeft(this.left);
      this.setItemHeight(this.height);
      this.setItemWidth(this.width);
    }
    if (this.gridster.checkCollision(this.gridsterItem.$item, true)) {
      this.resetSouth(hasRatio);
      this.resetWest(hasRatio);
      return;
    }
    this.gridster.previewStyle();
    this.pushResize.checkPushBack();
    this.push.checkPushBack();
  };

  private handleSouthEast = (e: MouseEvent): void => {
    this.handleSouth(e, false);
    this.handleEast(e, false);
    const hasRatio = !!(
      this.gridster.$options.itemAspectRatio ||
      this.gridsterItem.$item.itemAspectRatio
    );
    if (hasRatio) {
      this.setItemHeight(this.height);
      this.setItemWidth(this.width);
    }
    if (this.gridster.checkCollision(this.gridsterItem.$item, true)) {
      this.resetSouth(hasRatio);
      this.resetEast(hasRatio);
      return;
    }
    this.gridster.previewStyle();
    this.pushResize.checkPushBack();
    this.push.checkPushBack();
  };

  private resetNorth(soft = false) {
    this.gridsterItem.$item.y = this.itemBackup[1];
    this.gridsterItem.$item.rows = this.itemBackup[3];
    if (!soft) {
      this.top = this.gridster.positionYToPixels(this.gridsterItem.$item.y);
      this.setItemTop(
        this.gridster.positionYToPixels(this.gridsterItem.$item.y)
      );
      this.setItemHeight(
        this.gridster.positionYToPixels(this.gridsterItem.$item.rows) -
          this.margin
      );
    }
  }

  private resetEast(soft = false) {
    this.gridsterItem.$item.cols = this.itemBackup[2];
    if (!soft) {
      this.setItemWidth(
        this.gridster.positionXToPixels(this.gridsterItem.$item.cols) -
          this.margin
      );
    }
  }

  private resetSouth(soft = false) {
    this.gridsterItem.$item.rows = this.itemBackup[3];
    if (!soft) {
      this.setItemHeight(
        this.gridster.positionYToPixels(this.gridsterItem.$item.rows) -
          this.margin
      );
    }
  }

  private resetWest(soft = false) {
    this.gridsterItem.$item.x = this.itemBackup[0];
    this.gridsterItem.$item.cols = this.itemBackup[2];
    if (!soft) {
      this.left = this.gridster.positionXToPixels(this.gridsterItem.$item.x);
      this.setItemLeft(
        this.gridster.positionXToPixels(this.gridsterItem.$item.x)
      );
      this.setItemWidth(
        this.gridster.positionXToPixels(this.gridsterItem.$item.cols) -
          this.margin
      );
    }
  }

  toggle(): void {
    this.resizeEnabled = this.gridsterItem.canBeResized();
    this.resizableHandles = this.gridsterItem.getResizableHandles();
  }

  dragStartDelay(e: MouseEvent | TouchEvent): void {
    GridsterUtils.checkTouchEvent(e);

    if (!this.gridster.$options.resizable.delayStart) {
      this.dragStart(e as MouseEvent);
      return;
    }

    const timeout = setTimeout(() => {
      this.dragStart(e as MouseEvent);
      cancelDrag();
    }, this.gridster.$options.resizable.delayStart);

    const {
      cancelMouse,
      cancelMouseLeave,
      cancelOnBlur,
      cancelTouchMove,
      cancelTouchEnd,
      cancelTouchCancel
    } = this.zone.runOutsideAngular(() => {
      // Note: all of these events are being added within the `<root>` zone since they all
      // don't do any view updates and don't require Angular running change detection.
      // All event listeners call `cancelDrag` once the event is dispatched, the `cancelDrag`
      // is responsible only for removing event listeners.

      const cancelMouse = this.gridsterItem.renderer.listen(
        'document',
        'mouseup',
        cancelDrag
      );
      const cancelMouseLeave = this.gridsterItem.renderer.listen(
        'document',
        'mouseleave',
        cancelDrag
      );
      const cancelOnBlur = this.gridsterItem.renderer.listen(
        'window',
        'blur',
        cancelDrag
      );
      const cancelTouchMove = this.gridsterItem.renderer.listen(
        'document',
        'touchmove',
        cancelMove
      );
      const cancelTouchEnd = this.gridsterItem.renderer.listen(
        'document',
        'touchend',
        cancelDrag
      );
      const cancelTouchCancel = this.gridsterItem.renderer.listen(
        'document',
        'touchcancel',
        cancelDrag
      );
      return {
        cancelMouse,
        cancelMouseLeave,
        cancelOnBlur,
        cancelTouchMove,
        cancelTouchEnd,
        cancelTouchCancel
      };
    });

    function cancelMove(eventMove: MouseEvent): void {
      GridsterUtils.checkTouchEvent(eventMove);
      if (
        Math.abs(eventMove.clientX - (e as MouseEvent).clientX) > 9 ||
        Math.abs(eventMove.clientY - (e as MouseEvent).clientY) > 9
      ) {
        cancelDrag();
      }
    }

    function cancelDrag(): void {
      clearTimeout(timeout);
      cancelOnBlur();
      cancelMouse();
      cancelMouseLeave();
      cancelTouchMove();
      cancelTouchEnd();
      cancelTouchCancel();
    }
  }

  setItemTop(top: number): void {
    this.gridster.gridRenderer.setCellPosition(
      this.gridsterItem.renderer,
      this.gridsterItem.el,
      this.left,
      top
    );
  }

  setItemLeft(left: number): void {
    this.gridster.gridRenderer.setCellPosition(
      this.gridsterItem.renderer,
      this.gridsterItem.el,
      left,
      this.top
    );
  }

  setItemHeight(height: number): void {
    this.gridsterItem.renderer.setStyle(
      this.gridsterItem.el,
      'height',
      height + 'px'
    );
  }

  setItemWidth(width: number): void {
    this.gridsterItem.renderer.setStyle(
      this.gridsterItem.el,
      'width',
      width + 'px'
    );
  }
}
