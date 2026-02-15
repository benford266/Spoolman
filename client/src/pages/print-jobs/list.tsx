import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import { useInvalidate, useTranslate } from "@refinedev/core";
import { Button, Table, Typography } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Action, ActionsColumn, DateColumn, NumberColumn, SortedColumn } from "../../components/column";
import { useLiveify } from "../../components/liveify";
import { TableState, useInitialTableState, useStoreInitialState } from "../../utils/saveload";
import { useCurrencyFormatter } from "../../utils/settings";
import { IPrintJob } from "./model";

dayjs.extend(utc);

const { Text } = Typography;

const namespace = "printJobList";

const allColumns: (keyof IPrintJob & string)[] = [
  "id",
  "name",
  "spool_id",
  "weight_used",
  "cost",
  "revenue",
  "started_at",
  "completed_at",
  "registered",
  "notes",
];

const defaultColumns = allColumns.filter(
  (column_id) => ["notes", "external_reference"].indexOf(column_id) === -1,
);

export const PrintJobList = () => {
  const t = useTranslate();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const currencyFormatter = useCurrencyFormatter();

  // Load initial state
  const initialState = useInitialTableState(namespace);

  // Fetch data from the API
  const { tableProps, sorters, setSorters, currentPage, pageSize, setCurrentPage } = useTable<IPrintJob>({
    syncWithLocation: false,
    pagination: {
      mode: "server",
      currentPage: initialState.pagination.currentPage,
      pageSize: initialState.pagination.pageSize,
    },
    sorters: {
      mode: "server",
      initial: initialState.sorters,
    },
    liveMode: "manual",
    onLiveEvent(event) {
      if (event.type === "created" || event.type === "deleted") {
        invalidate({
          resource: "print-job",
          invalidates: ["list"],
        });
      }
    },
  });

  useLiveify("print-job", tableProps);

  // Store state in local storage
  const tableState: TableState = useMemo(
    () => ({
      sorters,
      pagination: {
        currentPage,
        pageSize,
      },
    }),
    [sorters, currentPage, pageSize],
  );
  useStoreInitialState(namespace, tableState);

  const columns = useMemo(() => {
    const allColumnsObjects = [
      {
        key: "id",
        ...SortedColumn(t, "print_job.fields.id", "id", sorters, setSorters),
        ...NumberColumn(t, "print_job.fields.id"),
      },
      {
        key: "name",
        ...SortedColumn(t, "print_job.fields.name", "name", sorters, setSorters),
        render: (value: string) => <Text strong>{value}</Text>,
      },
      {
        key: "spool_id",
        ...SortedColumn(t, "print_job.fields.spool_id", "spool_id", sorters, setSorters),
        ...NumberColumn(t, "print_job.fields.spool_id"),
        render: (value: number) => (
          <Button type="link" onClick={() => navigate(`/spool/show/${value}`)}>
            {t("print_job.fields.spool")} #{value}
          </Button>
        ),
      },
      {
        key: "weight_used",
        ...SortedColumn(t, "print_job.fields.weight_used", "weight_used", sorters, setSorters),
        ...NumberColumn(t, "print_job.fields.weight_used", { digits: 1, suffix: " g" }),
      },
      {
        key: "cost",
        ...SortedColumn(t, "print_job.fields.cost", "cost", sorters, setSorters),
        render: (value?: number) => (value !== undefined ? currencyFormatter(value) : "-"),
      },
      {
        key: "revenue",
        ...SortedColumn(t, "print_job.fields.revenue", "revenue", sorters, setSorters),
        render: (value?: number) => (value !== undefined ? currencyFormatter(value) : "-"),
      },
      {
        key: "profit",
        title: t("print_job.fields.profit"),
        render: (_: unknown, record: IPrintJob) => {
          if (record.revenue !== undefined && record.cost !== undefined) {
            const profit = record.revenue - record.cost;
            return (
              <Text type={profit >= 0 ? "success" : "danger"}>
                {currencyFormatter(profit)}
              </Text>
            );
          }
          return "-";
        },
      },
      {
        key: "started_at",
        ...SortedColumn(t, "print_job.fields.started_at", "started_at", sorters, setSorters),
        ...DateColumn(t, "print_job.fields.started_at"),
      },
      {
        key: "completed_at",
        ...SortedColumn(t, "print_job.fields.completed_at", "completed_at", sorters, setSorters),
        ...DateColumn(t, "print_job.fields.completed_at"),
      },
      {
        key: "registered",
        ...SortedColumn(t, "print_job.fields.registered", "registered", sorters, setSorters),
        ...DateColumn(t, "print_job.fields.registered"),
      },
      {
        key: "notes",
        title: t("print_job.fields.notes"),
        render: (value?: string) => (value ? <Text ellipsis>{value}</Text> : "-"),
      },
      {
        key: "actions",
        ...ActionsColumn<IPrintJob>(t),
        render: (_, record) => (
          <>
            <Action
              key="show"
              icon={<EyeOutlined />}
              title={t("buttons.show")}
              onClick={() => navigate(`/print-job/show/${record.id}`)}
            />
            <Action
              key="edit"
              icon={<EditOutlined />}
              title={t("buttons.edit")}
              onClick={() => navigate(`/print-job/edit/${record.id}`)}
            />
            <Action
              key="delete"
              icon={<DeleteOutlined />}
              title={t("buttons.delete")}
              onClick={async () => {
                if (confirm(t("print_job.confirm_delete", { name: record.name }))) {
                  await fetch(`/api/v1/print-job/${record.id}`, { method: "DELETE" });
                  invalidate({ resource: "print-job", invalidates: ["list"] });
                }
              }}
              danger
            />
          </>
        ),
      },
    ];

    return allColumnsObjects;
  }, [t, sorters, setSorters, navigate, invalidate, currencyFormatter]);

  return (
    <List
      headerButtons={({ defaultButtons }) => (
        <>
          {defaultButtons}
          <Button type="primary" onClick={() => navigate("/print-job/create")}>
            {t("print_job.titles.create")}
          </Button>
        </>
      )}
    >
      <Table
        {...tableProps}
        columns={columns}
        rowKey="id"
        pagination={{
          ...tableProps.pagination,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100"],
        }}
      />
    </List>
  );
};
