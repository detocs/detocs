import { ComponentChildren, Fragment, h, RefObject, VNode } from 'preact';
import { CSSProperties } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';
import { usePopper } from 'react-popper';

import useId from './hooks/id';
import Icon from './icon';

export interface MenuAction {
  label: ComponentChildren;
  onClick: () => void;
}

export interface MenuSection {
  label: ComponentChildren;
  actions: MenuAction[];
}

export function Menu({
  label,
  actions,
  defaultAction,
}: {
  label: string,
  actions: (MenuAction|MenuSection)[],
  defaultAction?: MenuAction,
}): VNode {
  const [ show, setShow ] = useState(false);
  const [ focusIndex, setFocusIndex ] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [ triggerId, menuId ] = useId(2, 'menu-');

  const numActions = actions.reduce((sum, a) => sum + (isMenuSection(a) ? a.actions.length : 1), 0);
  const iconName = show ? 'dropdown-open' : 'dropdown-closed';

  function openMenu(focusIndex: number): void {
    dropdownRef.current?.focus();
    setFocusIndex(focusIndex);
    setShow(true);
  }

  function closeMenu(): void {
    if (dropdownRef.current && dropdownRef.current.contains(document.activeElement)) {
      triggerRef.current?.focus();
    }
    setShow(false);
  }

  function handleTriggerKeyboard(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        openMenu(0);
        event.preventDefault();
        break;
      case 'ArrowUp':
        openMenu(numActions - 1);
        event.preventDefault();
        break;
      default:
        break;
    }
  }

  function handleContainerKeyboard(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowUp':
        setFocusIndex(i => (i - 1 + numActions) % numActions);
        event.preventDefault();
        break;
      case 'ArrowDown':
        setFocusIndex(i => (i + 1) % numActions);
        event.preventDefault();
        break;
      case 'Home':
        setFocusIndex(0);
        event.preventDefault();
        break;
      case 'End':
        setFocusIndex(numActions - 1);
        event.preventDefault();
        break;
      case 'Escape':
        closeMenu();
        event.preventDefault();
        break;
      default:
        break;
    }
  }

  const clickOutsideProps = useFocusOutside(closeMenu);

  return (
    <span ref={anchorRef} class="menu__button-group">
      {defaultAction &&
        <button
          type="button"
          onClick={() => defaultAction.onClick()}
          class="menu__default-action"
        >
          {defaultAction.label}
        </button>
      }
      <span class="menu__trigger-container" {...clickOutsideProps}>
        <button
          ref={triggerRef}
          type="button"
          id={triggerId}
          aria-hasPopup="menu"
          aria-expanded={show}
          aria-controls={menuId}
          onClick={() => show ? closeMenu() : openMenu(0)}
          onKeyDown={handleTriggerKeyboard}
        >
          {defaultAction
            ? <Icon label={label} name={iconName} />
            : <Fragment>{label} <Icon name={iconName} /></Fragment>
          }
        </button>
        {show && <Popover anchorRef={anchorRef}>
          <div
            ref={dropdownRef}
            id={menuId}
            role="menu"
            aria-labelledBy={triggerId}
            tabIndex={-1}
            onKeyDown={handleContainerKeyboard}
            class="menu__list"
          >
            {renderActions({
              actions,
              index: 0,
              focusIndex,
              containerRef: dropdownRef,
              triggerRef,
              closeMenu
            })}
          </div>
        </Popover>}
      </span>
    </span>
  );
}

function renderActions({
  actions,
  index,
  focusIndex,
  containerRef,
  triggerRef,
  closeMenu,
}: {
  actions: (MenuAction | MenuSection)[],
  index: number,
  focusIndex: number,
  containerRef: RefObject<HTMLElement>,
  triggerRef: RefObject<HTMLElement>,
  closeMenu: () => void,
}): ComponentChildren {
  const rendered = [];
  for (const a of actions) {
    if (isMenuSection(a)) {
      rendered.push(
        <MenuGroup
          key={index}
          label={a.label}
        >
          {renderActions({
            actions: a.actions,
            index,
            focusIndex,
            containerRef,
            triggerRef,
            closeMenu,
          })}
        </MenuGroup>
      );
      index += a.actions.length;
    } else {
      rendered.push(
        <MenuItem
          key={index}
          action={a}
          closeMenu={closeMenu}
          focused={focusIndex === index}
          containerRef={containerRef}
          triggerRef={triggerRef}
        />
      );
      index += 1;
    }
  }
  return rendered;
}

function MenuItem({
  action,
  focused,
  containerRef,
  triggerRef,
  closeMenu,
}: {
  action: MenuAction,
  focused: boolean,
  containerRef: RefObject<HTMLElement>,
  triggerRef: RefObject<HTMLElement>,
  closeMenu: () => void,
}): VNode {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focused &&
      ref.current &&
      ((containerRef.current && containerRef.current.contains(document.activeElement)) ||
      (triggerRef.current && triggerRef.current.contains(document.activeElement)))
    ) {
      ref.current.focus();
    }
  });
  return (
    <button
      type="button"
      ref={ref}
      role="menuitem"
      onClick={() => {
        action.onClick();
        closeMenu();
      }}
      tabIndex={focused ? 0 : -1}
    >
      {action.label}
    </button>
  );
}

function MenuGroup({
  label,
  children,
}: {
  label: ComponentChildren,
  children: ComponentChildren,
}): VNode {
  const [ labelId ] = useId(1, 'menu-group-');
  return (
    <fieldset role="group" class="menu__group">
      <legend id={labelId}>{label}</legend>
      <div class="menu__group-inner">
        {children}
      </div>
    </fieldset>
  );
}

function Popover({
  anchorRef,
  children,
}: {
  anchorRef: RefObject<HTMLElement>,
  children: ComponentChildren,
}): VNode {
  const [ popoverElement, setPopoverElement ] = useState<HTMLDivElement|null>(null);
  const { styles, attributes } = usePopper(anchorRef.current, popoverElement, {
    placement: 'bottom-end',
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [0, 3],
        },
      },
      {
        name: 'flip',
        options: {
          padding: 3,
          boundary: document.body,
        },
      },
      {
        name: 'preventOverflow',
        options: {
          altAxis: true,
          boundary: document.body,
        },
      },
    ],
  });
  return (
    <div
      ref={setPopoverElement}
      style={styles.popper as CSSProperties}
      class="menu__popover"
      {...attributes.popper}>
      {children}
    </div>
  );
}

function isMenuSection(a: MenuSection|MenuAction): a is MenuSection {
  return !!(a as MenuSection).actions;
}

function useFocusOutside(callback: () => void): JSXInternal.DOMAttributes<HTMLElement> {
  const timeout = useRef<number|null>(null);

  function cancelCallback(): void {
    if (timeout.current != null) {
      window.clearTimeout(timeout.current);
      timeout.current = null;
    }
  }
  function enqueueCallback(): void {
    cancelCallback();
    timeout.current = window.setTimeout(() => {
      callback();
    });
  }

  useEffect(() => {
    document.addEventListener('click', enqueueCallback, { capture: true });
    return () => document.removeEventListener('click', enqueueCallback, { capture: true });
  }, []);

  return ({
    onBlurCapture: enqueueCallback,
    onFocusCapture: cancelCallback,
    onClickCapture: cancelCallback,
  });
}
