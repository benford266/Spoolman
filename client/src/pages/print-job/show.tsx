import { DeleteButton, EditButton, Show } from "@refinedev/antd";
import { useShow, useTranslate } from "@refinedev/core";
import { Card, Descriptions, Space, Typography } from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router";
import { useCurrencyFormatter } from "../../utils/settings";
import { IPrintJob } from "./model";

const { Text } = Typography;

export const PrintJobShow = () => {
  const t = useTranslate();
  const navigate = useNavigate();
  const currencyFormatter = useCurrencyFormatter();
  const { query } = useShow<IPrintJob>();
  const { data, isLoading } = query;
  const record = data?.data;

  const profit =
    record?.revenue !== undefined && record?.cost !== undefined ? record.revenue - record.cost : undefined;

  return (
    <Show
      isLoading={isLoading}
      headerButtons={({ defaultButtons }) => (
        <Space>
          <EditButton />
          <DeleteButton />
          {defaultButtons}
        </Space>
      )}
    >
      <Card title={t("print_job.titles.details")} loading={isLoading}>
        <Descriptions bordered column={1}>
          <Descriptions.Item label={t("print_job.fields.id")}>{record?.id}</Descriptions.Item>
          <Descriptions.Item label={t("print_job.fields.name")}>
            <Text strong>{record?.name}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t("print_job.fields.spool_id")}>
            <a onClick={() => navigate(`/spool/show/${record?.spool_id}`)}>
              {t("print_job.fields.spool")} #{record?.spool_id}
            </a>
          </Descriptions.Item>
          <Descriptions.Item label={t("print_job.fields.weight_used")}>
            {record?.weight_used.toFixed(1)} g
          </Descriptions.Item>
          <Descriptions.Item label={t("print_job.fields.cost")}>
            {record?.cost !== undefined ? currencyFormatter.format(record.cost) : "-"}
          </Descriptions.Item>
          <Descriptions.Item label={t("print_job.fields.revenue")}>
            {record?.revenue !== undefined ? currencyFormatter.format(record.revenue) : "-"}
          </Descriptions.Item>
          {profit !== undefined && (
            <Descriptions.Item label={t("print_job.fields.profit")}>
              <Text type={profit >= 0 ? "success" : "danger"}>{currencyFormatter.format(profit)}</Text>
            </Descriptions.Item>
          )}
          <Descriptions.Item label={t("print_job.fields.started_at")}>
            {record?.started_at ? dayjs(record.started_at).format("YYYY-MM-DD HH:mm:ss") : "-"}
          </Descriptions.Item>
          <Descriptions.Item label={t("print_job.fields.completed_at")}>
            {record?.completed_at ? dayjs(record.completed_at).format("YYYY-MM-DD HH:mm:ss") : "-"}
          </Descriptions.Item>
          <Descriptions.Item label={t("print_job.fields.registered")}>
            {record?.registered ? dayjs(record.registered).format("YYYY-MM-DD HH:mm:ss") : "-"}
          </Descriptions.Item>
          {record?.notes && (
            <Descriptions.Item label={t("print_job.fields.notes")}>{record.notes}</Descriptions.Item>
          )}
          {record?.external_reference && (
            <Descriptions.Item label={t("print_job.fields.external_reference")}>
              {record.external_reference}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    </Show>
  );
};

export default PrintJobShow;
