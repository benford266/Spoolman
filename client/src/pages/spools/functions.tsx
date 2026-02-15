import { useSelect, useTranslate } from "@refinedev/core";
import { useQueries } from "@tanstack/react-query";
import { Checkbox, Form, Input, InputNumber, Modal, Radio } from "antd";
import { useForm } from "antd/es/form/Form";
import type { InputNumberRef } from "rc-input-number";
import { useCallback, useMemo, useRef, useState } from "react";
import { formatLength, formatWeight } from "../../utils/parsing";
import { SpoolType, useGetExternalDBFilaments } from "../../utils/queryExternalDB";
import { getAPIURL } from "../../utils/url";
import { IFilament } from "../filaments/model";
import { ISpool } from "./model";

export async function setSpoolArchived(spool: ISpool, archived: boolean) {
  const init: RequestInit = {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      archived: archived,
    }),
  };
  const request = new Request(getAPIURL() + "/spool/" + spool.id);
  await fetch(request, init);
}

export interface UseSpoolFilamentOptions {
  length?: number;
  weight?: number;
  jobName?: string;
  jobRevenue?: number;
  jobNotes?: string;
  jobStartedAt?: string;
  jobCompletedAt?: string;
}

/**
 * Use some spool filament from this spool. Either specify length or weight.
 * Optionally create a print job record.
 * @param spool The spool
 * @param options Options for filament usage and optional job creation
 */
export async function useSpoolFilament(spool: ISpool, options: UseSpoolFilamentOptions) {
  const init: RequestInit = {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      use_length: options.length,
      use_weight: options.weight,
      job_name: options.jobName,
      job_revenue: options.jobRevenue,
      job_notes: options.jobNotes,
      job_started_at: options.jobStartedAt,
      job_completed_at: options.jobCompletedAt,
    }),
  };
  const request = new Request(`${getAPIURL()}/spool/${spool.id}/use`);
  await fetch(request, init);
}

/**
 * Adjust usage based on the spool's current gross weight
 * @param spool The spool
 * @param weight The weight of the spool, in g
 */
export async function useSpoolFilamentMeasure(spool: ISpool, weight: number) {
  const init: RequestInit = {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      weight: weight,
    }),
  };
  const request = new Request(`${getAPIURL()}/spool/${spool.id}/measure`);
  await fetch(request, init);
}

/**
 * Returns an array of queries using the useQueries hook from @tanstack/react-query.
 * Each query fetches a spool by its ID from the server.
 *
 * @param {number[]} ids - An array of spool IDs to fetch.
 * @return An array of query results, each containing the fetched spool data.
 */
export function useGetSpoolsByIds(ids: number[]) {
  return useQueries({
    queries: ids.map((id) => {
      return {
        queryKey: ["spool", id],
        queryFn: async () => {
          const res = await fetch(getAPIURL() + "/spool/" + id);
          return (await res.json()) as ISpool;
        },
      };
    }),
  });
}

/**
 * Formats a filament label with the given parameters.
 */
export function formatFilamentLabel(
  name: string,
  diameter: number,
  vendorName?: string,
  material?: string,
  weight?: number,
  spoolType?: SpoolType,
): string {
  const portions = [];
  if (vendorName) {
    portions.push(vendorName);
  }
  portions.push(name);
  const extras = [];
  if (material) {
    extras.push(material);
  }
  extras.push(formatLength(diameter));
  if (weight) {
    extras.push(formatWeight(weight));
  }
  if (spoolType) {
    extras.push(spoolType.charAt(0).toUpperCase() + spoolType.slice(1) + " spool");
  }
  return `${portions.join(" - ")} (${extras.join(", ")})`;
}

interface SelectOption {
  label: string;
  value: string | number;
  weight?: number;
  spool_weight?: number;
  is_internal: boolean;
}

export function useGetFilamentSelectOptions() {
  // Setup hooks
  const t = useTranslate();
  const { query: internalFilaments } = useSelect<IFilament>({
    resource: "filament",
    pagination: { mode: "off" },
  });
  const externalFilaments = useGetExternalDBFilaments();

  // Format and sort internal filament options
  const filamentSelectInternal: SelectOption[] = useMemo(() => {
    const data =
      internalFilaments.data?.data.map((item) => {
        return {
          label: formatFilamentLabel(
            item.name ?? `ID ${item.id}`,
            item.diameter,
            item.vendor?.name,
            item.material,
            item.weight,
          ),
          value: item.id,
          weight: item.weight,
          spool_weight: item.spool_weight,
          is_internal: true,
        };
      }) ?? [];
    data.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    return data;
  }, [internalFilaments.data?.data]);

  // Format and sort external filament options
  const filamentSelectExternal: SelectOption[] = useMemo(() => {
    const data =
      externalFilaments.data?.map((item) => {
        return {
          label: formatFilamentLabel(
            item.name,
            item.diameter,
            item.manufacturer,
            item.material,
            item.weight,
            item.spool_type,
          ),
          value: item.id,
          weight: item.weight,
          spool_weight: item.spool_weight || undefined,
          is_internal: false,
        };
      }) ?? [];
    data.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    return data;
  }, [externalFilaments.data]);

  return {
    options: [
      {
        label: <span>{t("spool.fields.filament_internal")}</span>,
        options: filamentSelectInternal,
      },
      {
        label: <span>{t("spool.fields.filament_external")}</span>,
        options: filamentSelectExternal,
      },
    ],
    internalSelectOptions: filamentSelectInternal,
    externalSelectOptions: filamentSelectExternal,
    allExternalFilaments: externalFilaments.data,
  };
}

type MeasurementType = "length" | "weight" | "measured_weight";

export function useSpoolAdjustModal() {
  const t = useTranslate();
  const [form] = useForm();

  const [curSpool, setCurSpool] = useState<ISpool | null>(null);
  const [measurementType, setMeasurementType] = useState<MeasurementType>("length");
  const [createJob, setCreateJob] = useState(false);
  const inputNumberRef = useRef<InputNumberRef | null>(null);

  const openSpoolAdjustModal = useCallback((spool: ISpool) => {
    setCurSpool(spool);
    setCreateJob(false);
    form.resetFields();
    setTimeout(() => {
      inputNumberRef.current?.focus();
    }, 0);
  }, [form]);

  const spoolAdjustModal = useMemo(() => {
    if (curSpool === null) {
      return null;
    }

    const onSubmit = async () => {
      if (curSpool === null) {
        return;
      }

      const value = form.getFieldValue("filament_value");
      if (value === undefined || value === null) {
        return;
      }

      const options: UseSpoolFilamentOptions = {};

      if (measurementType === "measured_weight") {
        await useSpoolFilamentMeasure(curSpool, value);
      } else {
        if (measurementType === "length") {
          options.length = value;
        } else {
          options.weight = value;
        }

        // Add job tracking fields if checkbox is checked
        if (createJob) {
          options.jobName = form.getFieldValue("job_name");
          options.jobRevenue = form.getFieldValue("job_revenue");
          options.jobNotes = form.getFieldValue("job_notes");
        }

        await useSpoolFilament(curSpool, options);
      }

      setCurSpool(null);
      form.resetFields();
    };

    return (
      <Modal title={t("spool.titles.adjust")} open onCancel={() => setCurSpool(null)} onOk={form.submit}>
        <p>{t("spool.form.adjust_filament_help")}</p>
        <Form form={form} initialValues={{ measurement_type: measurementType }} onFinish={onSubmit}>
          <Form.Item label={t("spool.form.measurement_type_label")} name="measurement_type">
            <Radio.Group
              value={measurementType}
              onChange={({ target: { value } }) => setMeasurementType(value as MeasurementType)}
            >
              <Radio.Button value="length">{t("spool.form.measurement_type.length")}</Radio.Button>
              <Radio.Button value="weight">{t("spool.form.measurement_type.weight")}</Radio.Button>
              <Radio.Button value="measured_weight">{t("spool.fields.measured_weight")}</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item label={t("spool.form.adjust_filament_value")} name="filament_value">
            <InputNumber ref={inputNumberRef} precision={1} addonAfter={measurementType === "length" ? "mm" : "g"} />
          </Form.Item>

          {measurementType !== "measured_weight" && (
            <>
              <Form.Item name="create_job" valuePropName="checked">
                <Checkbox onChange={(e) => setCreateJob(e.target.checked)}>
                  {t("spool.form.create_print_job")}
                </Checkbox>
              </Form.Item>

              {createJob && (
                <>
                  <Form.Item
                    label={t("print_job.fields.name")}
                    name="job_name"
                    rules={[{ required: true, message: t("print_job.errors.name_required") }]}
                  >
                    <Input placeholder={t("print_job.fields.name_placeholder")} maxLength={128} />
                  </Form.Item>
                  <Form.Item label={t("print_job.fields.revenue")} name="job_revenue">
                    <InputNumber min={0} step={0.01} precision={2} placeholder="0.00" style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item label={t("print_job.fields.notes")} name="job_notes">
                    <Input.TextArea rows={2} maxLength={1024} placeholder={t("print_job.fields.notes_placeholder")} />
                  </Form.Item>
                </>
              )}
            </>
          )}
        </Form>
      </Modal>
    );
  }, [curSpool, measurementType, createJob, t, form]);

  return {
    openSpoolAdjustModal,
    spoolAdjustModal,
  };
}
