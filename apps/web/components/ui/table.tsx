import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes
} from "react";

import { cx } from "./utils";

type TableWrapProps = HTMLAttributes<HTMLDivElement>;

export function TableWrap({ children, className, ...props }: TableWrapProps) {
  return (
    <div className={cx("ui-table-wrap", className)} {...props}>
      {children}
    </div>
  );
}

type TableProps = TableHTMLAttributes<HTMLTableElement>;

export function Table({ children, className, ...props }: TableProps) {
  return (
    <table className={cx("ui-table", className)} {...props}>
      {children}
    </table>
  );
}

type HeaderCellProps = ThHTMLAttributes<HTMLTableCellElement>;

export function HeaderCell({ children, className, ...props }: HeaderCellProps) {
  return (
    <th className={className} {...props}>
      {children}
    </th>
  );
}

type CellProps = TdHTMLAttributes<HTMLTableCellElement>;

export function Cell({ children, className, ...props }: CellProps) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  );
}

type ListProps = HTMLAttributes<HTMLDivElement>;

export function List({ children, className, ...props }: ListProps) {
  return (
    <div className={cx("ui-list", className)} {...props}>
      {children}
    </div>
  );
}

type ListItemProps = HTMLAttributes<HTMLDivElement>;

export function ListItem({ children, className, ...props }: ListItemProps) {
  return (
    <article className={cx("ui-list-item", className)} {...props}>
      {children}
    </article>
  );
}
