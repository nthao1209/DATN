import { useEffect, useMemo, useRef, useState } from 'react';

export type EditableRowBase = {
  id?: number;
  localId: string;
  isEdited?: boolean;
};

type BuildRowsResult<Row extends EditableRowBase> = {
  rows: Row[];
  initialById: Record<number, Row>;
};

type UseEditableRowsParams<Row extends EditableRowBase> = {
  buildRows: () => BuildRowsResult<Row>;
  resetDeps: unknown[];
  isSameRow: (current: Row, initial: Row) => boolean;
  isNewRowDirty: (row: Row) => boolean;
  createRow: () => Row;
  resetDeletedIdsOnBuild?: boolean;
};

export const useEditableRows = <Row extends EditableRowBase>({
  buildRows,
  resetDeps,
  isSameRow,
  isNewRowDirty,
  createRow,
  resetDeletedIdsOnBuild = false,
}: UseEditableRowsParams<Row>) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [focusRowKey, setFocusRowKey] = useState<string | number | null>(null);
  const [focusRowSignal, setFocusRowSignal] = useState(0);
  const initialRowsByIdRef = useRef<Record<number, Row>>({});

  useEffect(() => {
    const next = buildRows();
    initialRowsByIdRef.current = next.initialById;
    setRows(next.rows);
    if (resetDeletedIdsOnBuild) setDeletedIds([]);
  }, resetDeps);

  useEffect(() => {
    return () => {
      setRows((prev) => prev.filter((row) => row.id || isNewRowDirty(row)));
    };
  }, []);

  const isRowDirty = (row: Row) => {
    if (!row.id) return isNewRowDirty(row);
    const initial = initialRowsByIdRef.current[row.id];
    if (!initial) return true;
    return !isSameRow(row, initial);
  };

  const dirtyCount = useMemo(() => {
    const created = rows.filter((row) => !row.id && isNewRowDirty(row)).length;
    const edited = rows.filter((row) => row.id && isRowDirty(row)).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  const handleCellChange = <K extends keyof Row>(localId: string, key: K, value: Row[K]) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.localId !== localId) return row;
        const nextRow = { ...row, [key]: value };
        if (!row.id) return nextRow;
        const initial = initialRowsByIdRef.current[row.id];
        const isEdited = initial ? !isSameRow(nextRow, initial) : true;
        return { ...nextRow, isEdited };
      })
    );
  };

  const handleAddRow = () => {
    setRows((prev) => {
      const emptyRow = prev.find((row) => !row.id && !isNewRowDirty(row));

      if (emptyRow) {
        setFocusRowKey(emptyRow.localId);
        setFocusRowSignal((value) => value + 1);
        return prev;
      }

      const row = createRow();
      setFocusRowKey(row.localId);
      setFocusRowSignal((value) => value + 1);
      return [...prev, row];
    });
  };

  const handleDeleteRow = (row: Row) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((item) => item.localId !== row.localId));
  };

  const resetDeletedIds = () => setDeletedIds([]);
  const replaceRows = (next: BuildRowsResult<Row>) => {
    initialRowsByIdRef.current = next.initialById;
    setRows(next.rows);
    setDeletedIds([]);
  };

  const resetFocus = () => {
    setFocusRowKey(null);
    setFocusRowSignal((value) => value + 1);
  };

  const pruneEmptyNewRows = () => {
    setRows((prev) => prev.filter((row) => row.id || isNewRowDirty(row)));
  };

  return {
    rows,
    setRows,
    deletedIds,
    resetDeletedIds,
    focusRowKey,
    focusRowSignal,
    isRowDirty,
    dirtyCount,
    handleCellChange,
    handleAddRow,
    handleDeleteRow,
    replaceRows,
    resetFocus,
    pruneEmptyNewRows,
  };
};
