class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
};

export class Line {
  constructor(lx0, ly0, lx1, ly1, lineWidth, strokeStyle) {
    this.p0 = new Point(lx0, ly0);
    this.p1 = new Point(lx1, ly1);
    this.lineWidth = lineWidth;
    this.strokeStyle = strokeStyle;
    this.zindex = 0;
  }

  draw(ctx, chart) {
    const [cx0, cy0] = chart.toCanvasXY(this.p0.x, this.p0.y);
    const [cx1, cy1] = chart.toCanvasXY(this.p1.x, this.p1.y);
    const offset = 0; // this.lineWidth / 2;
    ctx.strokeStyle = this.strokeStyle;
    ctx.lineWidth = this.lineWidth;
    ctx.beginPath();
    ctx.moveTo(cx0 + offset, cy0 + offset);
    ctx.lineTo(cx1 + offset, cy1 + offset);
    ctx.stroke();
  }
};

export class Circle {
  constructor(lx, ly, r, primaryStyle, fill, props) {
    this.lx = lx;
    this.ly = ly;
    this.r = r; // phisical
    this.primaryStyle = primaryStyle;
    this.fill = fill;
    this.isMouseOn = false;
    this.props = props;
    this.lineWidth = 2;
    this.zindex = 2;
  }

  isin(lx, ly) {
    const d = (this.lx - lx) * (this.lx - lx) + (this.ly - ly) * (this.ly - ly);
    return d < this.r * this.r;
  }

  draw(ctx, chart) {
    const [x, y] = chart.toCanvasXY(this.lx, this.ly);
    const r = this.r;

    ctx.fillStyle = this.primaryStyle;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (!this.fill) {
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.beginPath();
      ctx.arc(x, y, r - this.lineWidth, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export class Chart {
  constructor(x0, y0, width, height, maxX, maxY) {
    this.x0 = x0;
    this.y0 = y0;
    this.width = width;
    this.height = height;
    this.maxX = maxX;
    this.maxY = maxY;
    this.series = [];
    this.objects = [];
  }

  addObject(obj) {
    this.objects.push(obj);
  }

  addSeries(series) {
    this.series.push(series);
  }

  isin(px, py) {
    return px >= this.x0 && px < this.x0 + this.width
      && py >= this.y0 && py < this.y0 + this.height;
  }

  _toLogicalX(x) {
    return (x - this.x0) * this.maxX / this.width;
  }

  _toLogicalY(y) {
    // return parseInt((this.y0 + this.height - y) * this.maxY / this.height);
    return (this.y0 + this.height - y) * this.maxY / this.height;
  }

  toLogical(x, y) {
    return [this._toLogicalX(x), this._toLogicalY(y)];
  }

  getX(x) {
    // return parseInt(this.x0 + this.width * x / this.maxX);
    return this.x0 + this.width * x / this.maxX;
  }

  getY(y) {
    // return parseInt(this.y0 + this.height - this.height * y / this.maxY);
    return this.y0 + this.height - this.height * y / this.maxY;
  }

  toCanvasXY(x, y) {
    return [this.getX(x), this.getY(y)]
  }

  drawLineP(ctx, x0, y0, x1, y1, lineWidth) {
    const offset = 0; lineWidth / 2;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x0 + offset, y0 + offset);
    ctx.lineTo(x1 + offset, y1 + offset);
    ctx.stroke();
  }

  drawLine(ctx, x0, y0, x1, y1, lineWidth) {
    const [cx0, cy0] = this.toCanvasXY(x0, y0);
    const [cx1, cy1] = this.toCanvasXY(x1, y1);
    this.drawLineP(ctx, cx0, cy0, cx1, cy1, lineWidth);
  }
} // class Chart


