import { ActionHandlerOptions } from "custom-card-helpers";
import { noChange } from "lit";
import { AttributePart, Directive, directive, DirectiveParameters } from "lit/directive.js";

interface ActionHandler extends HTMLElement {
    holdTime: number;
    bind(element: Element, options?: ActionHandlerOptions): void;
}

interface ActionHandlerElement extends HTMLElement {
    actionHandler?: {
        options: ActionHandlerOptions;
        start?: (ev: Event) => void;
        end?: (ev: Event) => void;
        handleKeyDown?: (ev: KeyboardEvent) => void;
    };
}

const getActionHandler = (): ActionHandler => {
    const body = document.body;
    if (body.querySelector("action-handler")) {
        return body.querySelector("action-handler") as ActionHandler;
    }
    
    const actionhandler = document.createElement("action-handler");
    body.appendChild(actionhandler);

    return actionhandler as ActionHandler;
};

export const actionHandlerBind = (
    element: ActionHandlerElement,
    options?: ActionHandlerOptions
) => {
    const actionhandler: ActionHandler = getActionHandler();
    if (!actionhandler) {
        return;
    }
    actionhandler.bind(element, options);
};

export const actionHandler = directive(
    class extends Directive {
        update(part: AttributePart, [options]: DirectiveParameters<this>) {
            actionHandlerBind(part.element as ActionHandlerElement, options);
            return noChange;
        }

        render(_options?: ActionHandlerOptions) {}
    }
);