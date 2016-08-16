import { decode } from "ent";
import { ChangeAction, AttributeChangeAction } from "sf-core/actions";
import { HTMLNodeDisplay } from "./displays";
import { EntityFactoryDependency, DocumentEntityFactoryDependency } from "sf-core/dependencies";
import { IEntity, IEntityEngine, IVisibleEntity, IElementEntity, findEntitiesBySource } from "sf-core/entities";
import { parse as parseCSS } from "sf-html-extension/parsers/css";
import { CSSStyleExpression, CSSStyleSheetExpression } from "sf-html-extension/parsers/css/expressions";

import {
  HTMLExpression,
  HTMLTextExpression,
  HTMLCommentExpression,
  HTMLElementExpression,
  HTMLFragmentExpression,
  HTMLAttributeExpression,
  IHTMLValueNodeExpression,
} from "../../parsers/html/expressions";

import {
  INode,
  Element,
  IElement,
  Attributes,
  ContainerNode,
  ValueNode,
  NodeSection,
  IContainerNode,
  GroupNodeSection,
  IDiffableValueNode,
} from "sf-core/markup";

import TAG_NAMES from "./tag-names";

function disposeEntity(entity: IHTMLEntity) {
  if (entity.parentNode) {
    const childNodes = (<HTMLElementEntity><any>entity.parentNode).source.childNodes;
    childNodes.splice(childNodes.indexOf(<any>entity.source), 1);
    entity.parentNode.removeChild(entity);
  }
}

function getDocument(node: IHTMLEntity): HTMLDocumentEntity {
  return node.parentNode ? node.parentNode instanceof HTMLDocumentEntity ? node.parentNode : undefined : undefined;
}


export class HTMLDocumentEntity extends ContainerNode {

  readonly stylesheet: CSSStyleSheetExpression = new CSSStyleSheetExpression([], null);

  cloneNode(deep?: boolean) {
    const clone = new HTMLDocumentEntity();
    if (deep)
    for (const child of this.childNodes) {
      clone.appendChild(<IHTMLEntity>child.cloneNode(true));
    }
    return clone;
  }

  _unlink(child: IHTMLEntity) {
    super._unlink(child);
    child.document = undefined;
  }

  _link(child: IHTMLEntity) {
    super._unlink(child);
    child.document = this;
  }
}


export interface IHTMLEntity extends IEntity {
  section: NodeSection|GroupNodeSection;
  document: HTMLDocumentEntity;
}

abstract class HTMLContainerEntity extends ContainerNode implements IHTMLEntity, IElementEntity {

  readonly type: string = null;
  readonly nodeName: string;
  readonly section: NodeSection|GroupNodeSection;
  public engine: IEntityEngine;
  private _document: HTMLDocumentEntity;

  constructor(readonly source: HTMLElementExpression|HTMLFragmentExpression) {
    super();
    this.nodeName = source.nodeName.toUpperCase();
    this.section = this.createSection();
  }

  get document(): HTMLDocumentEntity {
    return this._document;
  }

  set document(value: HTMLDocumentEntity) {
    this.willChangeDocument(value);
    const oldDocument = this._document;
    this._document = value;
    for (const child of this.childNodes) {
      (<IHTMLEntity>child).document = value;
    }
  }

  protected willChangeDocument(newDocument) {

  }

  insertDOMChildBefore(newChild: INode, beforeChild: INode) {
    this.section.targetNode.insertBefore(newChild, beforeChild);
  }

  appendDOMChild(newChild: INode) {
    this.section.appendChild(newChild);
  }

  updateSource() {
    for (const child of this.childNodes) {
      (<any>child).updateSource();
    }
  }

  static mapSourceChildren(source: HTMLElementExpression) {
    return source.childNodes;
  }

  protected createSection(): GroupNodeSection|NodeSection {
    const element = document.createElement(this.nodeName) as any;
    return new NodeSection(element);
  }

  async appendSourceChildNode(childNode: HTMLExpression): Promise<Array<IEntity>> {
    this.source.appendChildNodes(childNode);

    // since the child node is dependant on the other entities that
    // are loaded in, we'll need to update the entire entity tree in order
    // to return the proper entity
    // TODO - it may be more appropriate to leave this up to whatever is calling
    // appendSourceChildNode since there may be cases where the callee executes a batch of these. For now though,
    // it's better to leave this here to make things more DRY.
    await this.engine.update();

    // since we don't know the entity, or where it lives in this entity, we'll need to scan for it. It could
    // even be a collection of entities.
    return findEntitiesBySource(this, childNode);
  }

  _unlink(child: IHTMLEntity) {
    super._unlink(child);
    child.document = undefined;
  }

  _link(child: IHTMLEntity) {
    super._link(child);
    child.document = this.document;
    if (child.section) {
      let nextHTMLEntitySibling: IHTMLEntity;
      do {
        nextHTMLEntitySibling = <IHTMLEntity>child.nextSibling;
      } while (nextHTMLEntitySibling && !nextHTMLEntitySibling.section);

      if (nextHTMLEntitySibling) {
        // TODO - this assumes that the next sibling has a section property - it
        // might not. Need to traverse the next sibling for a node that actually has a section
        const ppSection = (<HTMLElementEntity>child.nextSibling).section;

        if (nextHTMLEntitySibling.section instanceof NodeSection) {
          this.insertDOMChildBefore(child.section.toFragment(), (<NodeSection>ppSection).targetNode);
        } else {
          this.insertDOMChildBefore(child.section.toFragment(), (<GroupNodeSection>ppSection).startNode);
        }
      } else {
        this.appendDOMChild(child.section.toFragment());
      }
    }
  }

  abstract cloneNode();

  dispose() {
    disposeEntity(this);
  }
}

export class HTMLElementEntity extends HTMLContainerEntity implements IHTMLEntity, IElementEntity, IElement {

  // no type specified since certain elements such as <style />, and <link />
  // do not fit into a particular category. This may change later on.
  readonly type: string = null;
  private _styleExpression: CSSStyleExpression;
  readonly attributes: Attributes = new Attributes();

  public section: GroupNodeSection|NodeSection;
  constructor(readonly source: HTMLElementExpression) {
    super(source);
    // TODO - attributes might need to be transformed here
    if (source.attributes) {
      for (const attribute of source.attributes) {
        this.setAttribute(attribute.name, attribute.value);
      }
    }
  }

  get styleExpression(): CSSStyleExpression {
    if (this._styleExpression) return this._styleExpression;
    const style = this.getAttribute("style");
    return this._styleExpression = style ? parseCSS(`style { ${style} }`).rules[0].style : new CSSStyleExpression([], null);
  }

  updateSource() {
    if (this.styleExpression.declarations.length) {
      this.source.setAttribute("style", this.styleExpression.toString());
    }
    super.updateSource();
  }

  static mapSourceChildren(source: HTMLElementExpression) {
    return source.childNodes;
  }

  removeAttribute(name: string) {
    this.attributes.remove(name);
    if (this.section instanceof NodeSection) {
      (<IElement>this.section.targetNode).removeAttribute(name);
    }
    for (let i = this.source.attributes.length; i--; ) {
      const attribute = this.source.attributes[i];
      if (attribute.name === name) {
        this.source.attributes.splice(i, 1);
        return;
      }
    }
  }

  getAttribute(name: string) {
    return this.attributes.get(name);
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  setAttribute(name: string, value: string) {

    if (this.section instanceof NodeSection) {
      (<IElement>this.section.targetNode).setAttribute(name, value);
    }

    let found = false;
    for (const attribute of this.source.attributes) {
      if (attribute.name === name) {
        attribute.value = value;
        found = true;
      }
    }

    // if the attribute does not exist on the expression, then create a new one.
    if (!found) {
      this.source.attributes.push(new HTMLAttributeExpression(name, value, undefined));
    }

    this.attributes.set(name, value);

    this.notify(new AttributeChangeAction(name, value));
  }

  cloneNode(deep?: boolean) {
    const entity = new HTMLElementEntity(this.source);
    if (deep)
    for (const child of this.childNodes) {
      entity.appendChild(child.cloneNode(deep));
    }
    return entity;
  }

  willUnmount() {
    this.section.remove();
  }
}

export class VisibleHTMLElementEntity extends HTMLElementEntity implements IVisibleEntity {

  readonly type: string = "display";

  // TODO - change to something such as DisplayComputer
  readonly display = new HTMLNodeDisplay(this);
}

export class HTMLDocumentFragmentEntity extends HTMLContainerEntity {

  createSection() {
    return new GroupNodeSection();
  }
  cloneNode(deep?: boolean) {
    const entity = new HTMLDocumentFragmentEntity(this.source);
    if (deep)
    for (const child of this.childNodes) {
      entity.appendChild(child.cloneNode(deep));
    }
    return entity;
  }
}

export abstract class HTMLValueNodeEntity<T extends IHTMLValueNodeExpression> extends ValueNode implements IHTMLEntity {

  readonly type: string = null;

  readonly section: NodeSection;
  private _node: Node;
  private _nodeValue: any;
  private _document: HTMLDocumentEntity;
  public engine: IEntityEngine;

  get document(): HTMLDocumentEntity {
    return this._document;
  }

  set document(value: HTMLDocumentEntity) {
    this.willChangeDocument(value);
    const oldDocument = this._document;
    this._document = value;
  }

  protected willChangeDocument(newDocument) {

  }

  constructor(readonly source: T) {
    super(source.nodeName, source.nodeValue);
    this.section = new NodeSection(this._node = this.createDOMNode(source.nodeValue) as any);
  }

  updateSource() {
    this.source.nodeValue = this.nodeValue;
  }

  get nodeValue(): any {
    return this._nodeValue;
  }

  set nodeValue(value: any) {
    this._nodeValue = value;
    if (this._node) this._node.nodeValue = decode(value);
  }

  willUnmount() {
    if (this._node.parentElement) {
      this._node.parentNode.removeChild(this._node);
    }
  }

  abstract createDOMNode(nodeValue: any): Node;

  dispose() {
    disposeEntity(this);
  }
}

export class HTMLTextEntity extends HTMLValueNodeEntity<HTMLTextExpression> {
  createDOMNode(nodeValue: any) {
    return document.createTextNode(decode(nodeValue));
  }
}

export class HTMLCommentEntity extends HTMLValueNodeEntity<HTMLCommentExpression> {
  createDOMNode(nodeValue: any) {
    return document.createComment(nodeValue);
  }
}

export const htmlElementDependencies        = TAG_NAMES.map((nodeName) => new EntityFactoryDependency(nodeName, VisibleHTMLElementEntity));
export const htmlTextDependency             = new EntityFactoryDependency("#text", HTMLTextEntity);
export const htmlCommentDependency          = new EntityFactoryDependency("#comment", HTMLCommentEntity);
export const htmlDocumentDependency         = new DocumentEntityFactoryDependency(HTMLDocumentEntity);
export const htmlDocumentFragmentDependency = new EntityFactoryDependency("#document-fragment", HTMLDocumentFragmentEntity);

