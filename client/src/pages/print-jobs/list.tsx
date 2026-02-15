import { DeleteOutlined, EditOutlined, EyeOutlined, FilterOutlined } from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import { useInvalidate, useNavigation, useTranslate } from "@refinedev/core";
import { Button, Dropdown, Modal, Table, Typography } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useCurrencyFormatter } from "../../utils/settings";
import { getAPIURL } from "../../utils/url";
import { IPrintJob } from "./model";

dayjs.extend(utc);

const { Text } = Typography;
const { confirm } = Modal;

export const PrintJobList = () => {
  const t = useTranslate();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const currencyFormatter = useCurrencyFormatter();

  const { tableProps, sorters, setSorters, setFilters, setCurrentPage } = useTable<IPrintJob>({
    syncWithLocation: false,
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

  if (tableProps.pagination) {
    tableProps.pagination.showSizeChanger = true;
  }

  const deletePrintJob = async (id: number) => {
    const response = await fetch(`${getAPIURL()}/print-job/${id}`, { method: "DELETE" });
    if (response.ok) {
      invalidate({ resource: "print-job", invalidates: ["list"] });
    }
  };

  const { editUrl, showUrl } = useNavigation();

  const columns = useMemo(
    () => [
      {
        key: "id",
        dataIndex: "id",
        title: t("print_job.fields.id"),
        sorter: true,
      },
      {
        key: "name",
        dataIndex: "name",
        title: t("print_job.fields.name"),
        sorter: true,
        render: (value: string) => <Text strong>{value}</Text>,
      },
      {
        key: "spool_id",
        dataIndex: "spool_id",
        title: t("print_job.fields.spool_id"),
        sorter: true,
        render: (value: number) => (
          <Button type="link" onClick={() => navigate(`/spool/show/${value}`)}>
            Spool #{value}
          </Button>
        ),
      },
      {
        key: "weight_used",
        dataIndex: "weight_used",
        title: t("print_job.fields.weight_used"),
        sorter: true,
        render: (value: number) => `${value.toFixed(1)} g`,
      },
      {
        key: "cost",
        dataIndex: "cost",
        title: t("print_job.fields.cost"),
        sorter: true,
        render: (value?: number) => (value !== undefined ? currencyFormatter.format(value) : "-"),
      },
      {
        key: "revenue",
        dataIndex: "revenue",
        title: t("print_job.fields.revenue"),
        sorter: true,
        render: (value?: number) => (value !== undefined ? currencyFormatter.format(value) : "-"),
      },
      {
        key: "profit",
        title: t("print_job.fields.profit"),
        render: (_: unknown, record: IPrintJob) => {
          if (record.revenue !== undefined && record.cost !== undefined) {
            const profit = record.revenue - record.cost;
            return <Text type={profit >= 0 ? "success" : "danger"}>{currencyFormatter.format(profit)}</Text>;
          }
          return "-";
        },
      },
      {
        key: "completed_at",
        dataIndex: "completed_at",
        title: t("print_job.fields.completed_at"),
        sorter: true,
        render: (value?: string) => (value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-"),
      },
      {
        key: "actions",
        title: t("buttons.actions") || "Actions",
        render: (_: unknown, record: IPrintJob) => (
          <Dropdown
            menu={{
              items: [
                {
                  key: "show",
                  icon: <EyeOutlined />,
                  label: t("buttons.show"),
                  onClick: () => navigate(showUrl("print-job", record.id)),
                },
                {
                  key: "edit",
                  icon: <EditOutlined />,
                  label: t("buttons.edit"),
                  onClick: () => navigate(editUrl("print-job", record.id)),
                },
                {
                  key: "delete",
                  icon: <DeleteOutlined />,
                  label: t("buttons.delete"),
                  danger: true,
                  onClick: () => {
                    confirm({
                      title: t("print_job.confirm_delete", { name: record.name }),
                      onOk: () => deletePrintJob(record.id),
                    });
                  },
                },
              ],
            }}
          >
            <Button>⋯</Button>
          </Dropdown>
        ),
      },
    ],
    [t, currencyFormatter, navigate, showUrl, editUrl],
  );

  return (
    <List
      headerButtons={({ defaultButtons }) => (
        <>
          <Button
            type="primary"
            icon={<FilterOutlined />}
            onClick={() => {
              setFilters([], "replace");
              setSorters([{ field: "id", order: "desc" }]);
              setCurrentPage(1);
            }}
          >
            {t("buttons.clearFilters")}
          </Button>
          {defaultButtons}
        </>
      )}
    >
      <Table {...tableProps} columns={columns} rowKey="id" />
    </List>
  );
};
