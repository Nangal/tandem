
 import { IApplication } from "sf-core/application";

 // components
 import { dependency as entityPreviewComponentDependency } from "./components/entity-preview";
 import { dependency as cssPaneComponentDependency } from "./components/css-pane";

 // models
 import { dependency as sfFileActiveRecordDependency } from "./models/sf-file";

 // services
 import { dependency as pasteEntityService } from "./services/paste-entity";

 // tools
import { dependency as textToolDependency } from "./models/text-tool";

// key bindings
import { dependencies as keyBindingDependencies } from "./key-bindings";

import { MimeTypeDependency } from "sf-core/dependencies";

 // entities
 import {
   htmlTextDependency,
   htmlCommentDependency,
   htmlDocumentDependency,
   htmlElementDependencies,
   htmlStyleEntityDependency,
   htmlTemplateEntityDependency,
   htmlDocumentFragmentDependency,
} from "./entities/html";

export const dependency = [

  // components
  cssPaneComponentDependency,
  entityPreviewComponentDependency,

  // services
  pasteEntityService,

  // models
  sfFileActiveRecordDependency,

  // tools
  textToolDependency,

  // key bindings
  ...keyBindingDependencies,

  // entities
  htmlTextDependency,
  htmlCommentDependency,
  htmlDocumentDependency,
  htmlStyleEntityDependency,
  ...htmlElementDependencies,
  htmlTemplateEntityDependency,
  htmlDocumentFragmentDependency,

  // mime types
  new MimeTypeDependency("htm", "text/html"),
  new MimeTypeDependency("html", "text/html"),
  new MimeTypeDependency("sfn", "text/html")
];
