import { NgZone } from '@angular/core';
import { GridsterComponentInterface } from './gridster.interface';
import { DirTypes } from './gridsterConfig.interface';
import { GridsterItemComponentInterface } from './gridsterItem.interface';
import { GridsterPush } from './gridsterPush.service';
import { cancelScroll, scroll } from './gridsterScroll.service';
import { GridsterComponent } from './gridster.component';

import { GridsterSwap } from './gridsterSwap.service';
import { GridsterUtils } from './gridsterUtils.service';

const GRIDSTER_ITEM_RESIZABLE_HANDLER_CLASS = 'gridster-item-resizable-handler';

enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT'
}

export class GridsterDraggable {
  gridsterItem: GridsterItemComponentInterface;
  gridster: GridsterComponentInterface;
  lastMouse: {
    clientX: number;
    clientY: number;
  };
  offsetLeft: number;
  offsetTop: number;
  margin: number;
  outerMarginTop: number | null;
  outerMarginRight: number | null;
  outerMarginBottom: number | null;
  outerMarginLeft: number | null;
  diffTop: number;
  diffLeft: number;
  originalClientX: number;
  originalClientY: number;
  top: number;
  left: number;
  height: number;
  width: number;
  positionX: number;
  positionY: number;
  positionXBackup: number;
  positionYBackup: number;
  enabled: boolean;
  mousemove: () => void;
  mouseup: () => void;
  mouseleave: () => void;
  cancelOnBlur: () => void;
  touchmove: () => void;
  touchend: () => void;
  touchcancel: () => void;
  mousedown: () => void;
  touchstart: () => void;
  push: GridsterPush;
  swap: GridsterSwap;
  path: Array<{ x: number; y: number }>;
  collision: GridsterItemComponentInterface | boolean = false;
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
    this.path = [];
  }

  destroy(): void {
    if (this.gridster.previewStyle) {
      this.gridster.previewStyle(true);
    }
    this.gridsterItem = this.gridster = this.collision = null!;
    if (this.mousedown) {
      this.mousedown();
      this.touchstart();
    }
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
      line.className = 'scaler-line';
      line.style.position = 'absolute';
      line.style.background = 'red';
      line.style.zIndex = '9999';
      line.style.pointerEvents = 'none';
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

    // this.topMatched = false;
    // this.bottomMatched = false;
    // this.leftMatched = false;
    // this.rightMatched = false;
  }

  dragStart(e: MouseEvent): void {
    if (e.which && e.which !== 1) {
      return;
    }

    if (
      this.gridster.options.draggable &&
      this.gridster.options.draggable.start
    ) {
      this.gridster.options.draggable.start(
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
      'gridster-item-moving'
    );
    this.margin = this.gridster.$options.margin;
    this.outerMarginTop = this.gridster.$options.outerMarginTop;
    this.outerMarginRight = this.gridster.$options.outerMarginRight;
    this.outerMarginBottom = this.gridster.$options.outerMarginBottom;
    this.outerMarginLeft = this.gridster.$options.outerMarginLeft;
    this.offsetLeft = this.gridster.el.scrollLeft - this.gridster.el.offsetLeft;
    this.offsetTop = this.gridster.el.scrollTop - this.gridster.el.offsetTop;
    this.left = this.gridsterItem.left - this.margin;
    this.top = this.gridsterItem.top - this.margin;
    this.originalClientX = e.clientX;
    this.originalClientY = e.clientY;
    this.width = this.gridsterItem.width;
    this.height = this.gridsterItem.height;
    if (this.gridster.$options.dirType === DirTypes.RTL) {
      this.diffLeft =
        e.clientX - this.gridster.el.scrollWidth + this.gridsterItem.left;
    } else {
      this.diffLeft = e.clientX + this.offsetLeft - this.margin - this.left;
    }
    this.diffTop = e.clientY + this.offsetTop - this.margin - this.top;
    this.gridster.movingItem = this.gridsterItem.$item;
    this.gridster.previewStyle(true);
    this.push = new GridsterPush(this.gridsterItem);
    this.swap = new GridsterSwap(this.gridsterItem);
    this.gridster.dragInProgress = true;
    this.gridster.updateGrid();
    this.path.push({
      x: this.gridsterItem.item.x || 0,
      y: this.gridsterItem.item.y || 0
    });
    console.log('✅ dragStart called');
  }

  dragMove = (e: MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    GridsterUtils.checkTouchEvent(e);

    // get the directions of the mouse event
    let directions = this.getDirections(e);

    if (this.gridster.options.enableBoundaryControl) {
      // prevent moving up at the top of gridster
      if (
        directions.includes(Direction.UP) &&
        this.gridsterItem.el.getBoundingClientRect().top <
          this.gridster.el.getBoundingClientRect().top +
            (this.outerMarginTop ?? this.margin)
      ) {
        directions = directions.filter(direction => direction != Direction.UP);
        e = new MouseEvent(e.type, {
          clientX: e.clientX,
          clientY: this.lastMouse.clientY
        });
      }
      // prevent moving left at the leftmost column of gridster
      if (
        directions.includes(Direction.LEFT) &&
        this.gridsterItem.el.getBoundingClientRect().left <
          this.gridster.el.getBoundingClientRect().left +
            (this.outerMarginLeft ?? this.margin)
      ) {
        directions = directions.filter(
          direction => direction != Direction.LEFT
        );
        e = new MouseEvent(e.type, {
          clientX: this.lastMouse.clientX,
          clientY: e.clientY
        });
      }
      // prevent moving right at the rightmost column of gridster
      if (
        directions.includes(Direction.RIGHT) &&
        this.gridsterItem.el.getBoundingClientRect().right >
          this.gridster.el.getBoundingClientRect().right -
            (this.outerMarginRight ?? this.margin)
      ) {
        directions = directions.filter(
          direction => direction != Direction.RIGHT
        );
        e = new MouseEvent(e.type, {
          clientX: this.lastMouse.clientX,
          clientY: e.clientY
        });
      }
      // prevent moving down at the bottom of gridster
      if (
        directions.includes(Direction.DOWN) &&
        this.gridsterItem.el.getBoundingClientRect().bottom >
          this.gridster.el.getBoundingClientRect().bottom -
            (this.outerMarginBottom ?? this.margin)
      ) {
        directions = directions.filter(
          direction => direction != Direction.DOWN
        );
        e = new MouseEvent(e.type, {
          clientX: e.clientX,
          clientY: this.lastMouse.clientY
        });
      }
    }

    // do not change item location when there is no direction to go
    if (directions.length) {
      this.offsetLeft =
        this.gridster.el.scrollLeft - this.gridster.el.offsetLeft;
      this.offsetTop = this.gridster.el.scrollTop - this.gridster.el.offsetTop;
      scroll(
        this.gridster,
        this.left,
        this.top,
        this.width,
        this.height,
        e,
        this.lastMouse,
        this.calculateItemPositionFromMousePosition
      );

      this.calculateItemPositionFromMousePosition(e);
    }

    this.isDragging = true;
    this.showScalerLine(this.gridsterItem);
    this.topMatched = false;
    this.bottomMatched = false;
    this.leftMatched = false;
    this.rightMatched = false;
  };

  calculateItemPositionFromMousePosition = (e: MouseEvent): void => {
    if (this.gridster.options.scale) {
      this.calculateItemPositionWithScale(e, this.gridster.options.scale);
    } else {
      this.calculateItemPositionWithoutScale(e);
    }
    this.calculateItemPosition();
    this.lastMouse.clientX = e.clientX;
    this.lastMouse.clientY = e.clientY;
    this.zone.run(() => {
      this.gridster.updateGrid();
    });
  };

  calculateItemPositionWithScale(e: MouseEvent, scale: number): void {
    if (this.gridster.$options.dirType === DirTypes.RTL) {
      this.left =
        this.gridster.el.scrollWidth -
        this.originalClientX +
        (e.clientX - this.originalClientX) / scale +
        this.diffLeft;
    } else {
      this.left =
        this.originalClientX +
        (e.clientX - this.originalClientX) / scale +
        this.offsetLeft -
        this.diffLeft;
    }
    this.top =
      this.originalClientY +
      (e.clientY - this.originalClientY) / scale +
      this.offsetTop -
      this.diffTop;
  }

  calculateItemPositionWithoutScale(e: MouseEvent): void {
    if (this.gridster.$options.dirType === DirTypes.RTL) {
      this.left = this.gridster.el.scrollWidth - e.clientX + this.diffLeft;
    } else {
      this.left = e.clientX + this.offsetLeft - this.diffLeft;
    }

    this.top = e.clientY + this.offsetTop - this.diffTop;
  }

  dragStop = (e: MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();

    cancelScroll();
    this.cancelOnBlur();
    this.mousemove();
    this.mouseup();
    this.mouseleave();
    this.touchmove();
    this.touchend();
    this.touchcancel();
    this.gridsterItem.renderer.removeClass(
      this.gridsterItem.el,
      'gridster-item-moving'
    );
    this.gridster.dragInProgress = false;
    this.gridster.updateGrid();
    this.path = [];
    if (
      this.gridster.options.draggable &&
      this.gridster.options.draggable.stop
    ) {
      Promise.resolve(
        this.gridster.options.draggable.stop(
          this.gridsterItem.item,
          this.gridsterItem,
          e
        )
      ).then(this.makeDrag, this.cancelDrag);
    } else {
      this.makeDrag();
    }
    setTimeout(() => {
      if (this.gridster) {
        this.gridster.movingItem = null;
        this.gridster.previewStyle(true);
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

  cancelDrag = (): void => {
    this.gridsterItem.$item.x = this.gridsterItem.item.x || 0;
    this.gridsterItem.$item.y = this.gridsterItem.item.y || 0;
    this.gridsterItem.setSize();
    if (this.push) {
      this.push.restoreItems();
    }
    if (this.swap) {
      this.swap.restoreSwapItem();
    }
    if (this.push) {
      this.push.destroy();
      this.push = null!;
    }
    if (this.swap) {
      this.swap.destroy();
      this.swap = null!;
    }
  };

  makeDrag = (): void => {
    if (
      this.gridster.$options.draggable.dropOverItems &&
      this.gridster.options.draggable &&
      this.gridster.options.draggable.dropOverItemsCallback &&
      this.collision &&
      this.collision !== true &&
      this.collision.$item
    ) {
      this.gridster.options.draggable.dropOverItemsCallback(
        this.gridsterItem.item,
        this.collision.item,
        this.gridster
      );
    }
    this.collision = false;
    this.gridsterItem.setSize();
    this.gridsterItem.checkItemChanges(
      this.gridsterItem.$item,
      this.gridsterItem.item
    );
    if (this.push) {
      this.push.setPushedItems();
    }
    if (this.swap) {
      this.swap.setSwapItem();
    }
    if (this.push) {
      this.push.destroy();
      this.push = null!;
    }
    if (this.swap) {
      this.swap.destroy();
      this.swap = null!;
    }
  };

  calculateItemPosition(): void {
    this.gridster.movingItem = this.gridsterItem.$item;
    this.positionX = this.gridster.pixelsToPositionX(this.left, Math.round);
    this.positionY = this.gridster.pixelsToPositionY(this.top, Math.round);
    this.positionXBackup = this.gridsterItem.$item.x;
    this.positionYBackup = this.gridsterItem.$item.y;
    this.gridsterItem.$item.x = this.positionX;
    if (this.gridster.checkGridCollision(this.gridsterItem.$item)) {
      this.gridsterItem.$item.x = this.positionXBackup;
    }
    this.gridsterItem.$item.y = this.positionY;
    if (this.gridster.checkGridCollision(this.gridsterItem.$item)) {
      this.gridsterItem.$item.y = this.positionYBackup;
    }
    this.gridster.gridRenderer.setCellPosition(
      this.gridsterItem.renderer,
      this.gridsterItem.el,
      this.left,
      this.top
    );

    if (
      this.positionXBackup !== this.gridsterItem.$item.x ||
      this.positionYBackup !== this.gridsterItem.$item.y
    ) {
      const lastPosition = this.path[this.path.length - 1];
      let direction = '';
      if (lastPosition.x < this.gridsterItem.$item.x) {
        direction = this.push.fromWest;
      } else if (lastPosition.x > this.gridsterItem.$item.x) {
        direction = this.push.fromEast;
      } else if (lastPosition.y < this.gridsterItem.$item.y) {
        direction = this.push.fromNorth;
      } else if (lastPosition.y > this.gridsterItem.$item.y) {
        direction = this.push.fromSouth;
      }
      this.push.pushItems(direction, this.gridster.$options.disablePushOnDrag);
      this.swap.swapItems();
      this.collision = this.gridster.checkCollision(this.gridsterItem.$item);
      if (this.collision) {
        this.gridsterItem.$item.x = this.positionXBackup;
        this.gridsterItem.$item.y = this.positionYBackup;
        if (
          this.gridster.$options.draggable.dropOverItems &&
          this.collision !== true &&
          this.collision.$item
        ) {
          this.gridster.movingItem = null;
        }
      } else {
        this.path.push({
          x: this.gridsterItem.$item.x,
          y: this.gridsterItem.$item.y
        });
      }
      this.push.checkPushBack();
    } else {
      // reset the collision when you drag and drop on an adjacent cell that is not empty
      // and go back to the cell you were in from the beginning,
      // this is to prevent `dropOverItemsCallback'
      this.collision = false;
    }
    this.gridster.previewStyle(true);
  }

  toggle(): void {
    const enableDrag = this.gridsterItem.canBeDragged();
    if (!this.enabled && enableDrag) {
      this.enabled = !this.enabled;
      this.mousedown = this.gridsterItem.renderer.listen(
        this.gridsterItem.el,
        'mousedown',
        this.dragStartDelay
      );
      this.touchstart = this.gridsterItem.renderer.listen(
        this.gridsterItem.el,
        'touchstart',
        this.dragStartDelay
      );
    } else if (this.enabled && !enableDrag) {
      this.enabled = !this.enabled;
      this.mousedown();
      this.touchstart();
    }
  }

  dragStartDelay = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    if (target.classList.contains(GRIDSTER_ITEM_RESIZABLE_HANDLER_CLASS)) {
      return;
    }
    if (GridsterUtils.checkContentClassForEvent(this.gridster, e)) {
      return;
    }
    GridsterUtils.checkTouchEvent(e);
    if (!this.gridster.$options.draggable.delayStart) {
      this.dragStart(e);
      return;
    }
    const timeout = setTimeout(() => {
      this.dragStart(e);
      cancelDrag();
    }, this.gridster.$options.draggable.delayStart);
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

    function cancelMove(eventMove: MouseEvent): void {
      GridsterUtils.checkTouchEvent(eventMove);
      if (
        Math.abs(eventMove.clientX - e.clientX) > 9 ||
        Math.abs(eventMove.clientY - e.clientY) > 9
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
  };

  /**
   * Returns the list of directions for given mouse event
   * @param e Mouse event
   * */
  private getDirections(e: MouseEvent) {
    const directions: string[] = [];
    if (this.lastMouse.clientX === 0 && this.lastMouse.clientY === 0) {
      this.lastMouse.clientY = e.clientY;
      this.lastMouse.clientX = e.clientX;
    }
    if (this.lastMouse.clientY > e.clientY) {
      directions.push(Direction.UP);
    }
    if (this.lastMouse.clientY < e.clientY) {
      directions.push(Direction.DOWN);
    }
    if (this.lastMouse.clientX < e.clientX) {
      directions.push(Direction.RIGHT);
    }
    if (this.lastMouse.clientX > e.clientX) {
      directions.push(Direction.LEFT);
    }
    return directions;
  }
}
