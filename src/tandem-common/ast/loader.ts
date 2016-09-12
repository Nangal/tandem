import { Action, EntityLoaderAction } from "tandem-common/actions";
import { IActor } from "tandem-common/actors";
import { WrapBus } from "mesh";
import { IDisposable } from "tandem-common/object";
import { patchTreeNode } from "tandem-common/tree";
import { bindable } from "tandem-common/decorators";
import { IObservable, Observable, watchProperty } from "tandem-common/observable";
import { IExpressionSource, IExpression, IExpressionStringFormatter } from "./base";

export abstract class BaseExpressionLoader extends Observable {

  private _source: IExpressionSource;
  private _expression: IExpression;
  private _contentWatcher: IDisposable;
  private _expressionObserver: IActor;
  private _content: string;
  private _options: any;

  constructor() {
    super();
    this._expressionObserver = new WrapBus(this.onExpressionAction.bind(this));
    this.options = {};
  }

  public get options(): any {
    return this._options;
  }

  public set options(value: any) {
    this._options = Object.assign({}, this.getDefaultOptions(), value);
  }

  public get source(): IExpressionSource {
    return this._source;
  }

  public get expression(): IExpression {
    return this._expression;
  }

  async load(source: IExpressionSource) {
    if (this._source) {
      this._contentWatcher.dispose();
    }

    this._source = source;

    this._contentWatcher  = watchProperty(this._source, "content", this.onSourceContentChange.bind(this));

    return await this.parse();
  }

  protected onSourceContentChange(newContent: string, oldContent: string) {
    this.parse();
  }

  protected abstract parseContent(content: string): IExpression;

  protected onExpressionAction(action: Action) {
    this.source.content = this.createFormattedSourceContent(action);
    this.parse();
    this.notify(new EntityLoaderAction(EntityLoaderAction.ENTITY_CONTENT_FORMATTED));
  }

  protected createFormattedSourceContent(action: Action) {
    return this._expression.toString();
  }

  private parse(): IExpression {

    if (this._content === this.source.content) {
      return;
    }

    const newExpression = this.parseContent(this._content = this.source.content);
    newExpression.source = this._source;

    if (this._expression) {
      this._expression.unobserve(this._expressionObserver);
      patchTreeNode(this._expression, newExpression);
      this._expression.observe(this._expressionObserver);
    } else {
      this._expression = newExpression;
      this._expression.observe(this._expressionObserver);
    }

    return this._expression;
  }

  protected getDefaultOptions() {
    return {};
  }
}