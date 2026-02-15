import { Create, useForm, useSelect } from "@refinedev/antd";
import { useTranslate } from "@refinedev/core";
import { DatePicker, Form, Input, InputNumber, Select } from "antd";
import dayjs from "dayjs";
import { IPrintJob } from "./model";

export const PrintJobCreate = () => {
  const t = useTranslate();
  const { formProps, saveButtonProps, form } = useForm<IPrintJob>();

  const { selectProps: spoolSelectProps } = useSelect({
    resource: "spool",
    optionLabel: (item) => `#${item.id} - ${item.filament?.name || "Unknown"}`,
    optionValue: "id",
  });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label={t("print_job.fields.spool_id")}
          name="spool_id"
          rules={[{ required: true, message: t("print_job.errors.spool_required") }]}
        >
          <Select
            {...spoolSelectProps}
            placeholder={t("print_job.fields.spool_placeholder")}
            showSearch
            filterOption={(input, option) =>
              (option?.label?.toString() ?? "").toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item
          label={t("print_job.fields.name")}
          name="name"
          rules={[{ required: true, message: t("print_job.errors.name_required") }]}
        >
          <Input placeholder={t("print_job.fields.name_placeholder")} maxLength={128} />
        </Form.Item>

        <Form.Item
          label={t("print_job.fields.weight_used")}
          name="weight_used"
          rules={[{ required: true, message: t("print_job.errors.weight_required") }]}
        >
          <InputNumber
            addonAfter="g"
            min={0}
            step={0.1}
            precision={2}
            placeholder="0.0"
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item label={t("print_job.fields.started_at")} name="started_at">
          <DatePicker
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            style={{ width: "100%" }}
            placeholder={t("print_job.fields.datetime_placeholder")}
          />
        </Form.Item>

        <Form.Item label={t("print_job.fields.completed_at")} name="completed_at">
          <DatePicker
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            style={{ width: "100%" }}
            placeholder={t("print_job.fields.datetime_placeholder")}
          />
        </Form.Item>

        <Form.Item label={t("print_job.fields.cost")} name="cost">
          <InputNumber
            min={0}
            step={0.01}
            precision={2}
            placeholder="0.00"
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item label={t("print_job.fields.revenue")} name="revenue">
          <InputNumber
            min={0}
            step={0.01}
            precision={2}
            placeholder="0.00"
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item label={t("print_job.fields.notes")} name="notes">
          <Input.TextArea
            rows={4}
            maxLength={1024}
            placeholder={t("print_job.fields.notes_placeholder")}
          />
        </Form.Item>

        <Form.Item label={t("print_job.fields.external_reference")} name="external_reference">
          <Input maxLength={256} placeholder={t("print_job.fields.external_reference_placeholder")} />
        </Form.Item>
      </Form>
    </Create>
  );
};
