export class Point {
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
    this.zindex = 1;
    this.visible = true;
  }

  setVisible(visible) {
    this.visible = visible;
  }

  moveTo(lx0, ly0, lx1, ly1) {
    this.p0.x = lx0;
    this.p0.y = ly0;
    this.p1.x = lx1;
    this.p1.y = ly1;
  }

  draw(ctx, chart) {
    if (!this.visible)
      return;

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

export class Rect {
  constructor(lx, ly, width, height, style) {
    this.p0 = new Point(lx, ly);
    this.p1 = new Point(lx + width, ly + height);
    this.style = style;
    this.visible = true;
    this.zindex = 0;
  }

  draw(ctx, chart) {
    if (!this.visible)
      return;

    const [x0, y0] = chart.toCanvasXY(this.p0.x, this.p0.y);
    const [x1, y1] = chart.toCanvasXY(this.p1.x, this.p1.y);
    ctx.fillStyle = this.style;
    ctx.fillRect(x0, y0, (x1 - x0), (y1 - y0));
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
    this.zindex = 3;
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

export class Text {
  constructor(config) {
    this.config = config;
    this.config.visible = config.visible || true;
    this.config.style = config.style || "rgb(100, 100, 100)"; // TODO
    this.zindex = 1;
  }

  moveTo(x, y) {
    this.config.x = x;
    this.config.y = y;
  }

  setText(text) {
    this.config.text = text;
  }

  setVisible(visible) {
    this.config.visible = visible;
  }

  draw(ctx, chart) {
    const conf = this.config;
    if (!conf.visible)
      return;

    let [x, y] = chart.toCanvasXY(conf.x, conf.y);
    x += conf.offsetX || 0;
    y += conf.offsetY || 0;

    ctx.fillStyle = conf.style || ctx.fillStyle;
    ctx.textAlign = conf.textAlign || "start";
    ctx.textBaseline = conf.textBaseline || "alphabetic";
    ctx.fillText(conf.text, x, y);
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
    this.objects = [];
  }

  addObject(...obj) {
    this.objects.push(...obj);
  }

  setObjects(objects) {
    this.objects = objects;
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


  draw(ctx) {
    // console.log("== draw ==");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(this.x0, this.y0, this.width, this.height);

    this.objects.sort((a, b) => a.zindex - b.zindex);
    this.objects.forEach(obj => {
      // console.log(obj.constructor.name, obj.zindex);
      obj.draw(ctx, this)
    });
  }
}


