import { HighlightOutlined } from "@ant-design/icons";
import { useList } from "@refinedev/core";
import { Card, Col, Progress, Row, Spin, Statistic, Table, Tag, Typography, theme } from "antd";
import { Content } from "antd/es/layout/layout";
import { useMemo } from "react";
import SpoolIcon from "../../components/spoolIcon";
import { ISpool } from "../spools/model";

const { Title, Text } = Typography;
const { useToken } = theme;

interface FilamentGroup {
  key: string;
  material: string;
  color_hex: string | undefined;
  multi_color_hexes: string | undefined;
  multi_color_direction: string | undefined;
  name: string | undefined;
  vendor_name: string | undefined;
  spool_count: number;
  total_remaining_weight: number;
  total_filament_weight: number;
}

function getColorDisplay(group: FilamentGroup): string | { colors: string[]; vertical: boolean } | undefined {
  if (group.multi_color_hexes) {
    return {
      colors: group.multi_color_hexes.split(","),
      vertical: group.multi_color_direction === "longitudinal",
    };
  }
  return group.color_hex;
}

function getColorLabel(group: FilamentGroup): string {
  if (group.multi_color_hexes) {
    return "Multi-color";
  }
  if (group.color_hex) {
    return `#${group.color_hex.replace("#", "").toUpperCase()}`;
  }
  return "Unknown";
}

export const Overview = () => {
  const { token } = useToken();

  const { result: spoolsResult, query: spoolsQuery } = useList<ISpool>({
    resource: "spool",
    pagination: { pageSize: 10000 },
    meta: {
      queryParams: {
        allow_archived: false,
      },
    },
  });

  const isLoading = spoolsQuery.isLoading;

  const { groups, totalRemainingWeight, totalSpools } = useMemo(() => {
    const spools: ISpool[] = spoolsResult?.data ?? [];
    const nonArchived = spools.filter((s: ISpool) => !s.archived);

    const groupMap = new Map<string, FilamentGroup>();

    for (const spool of nonArchived) {
      const f = spool.filament;
      const material = f.material ?? "Unknown";
      const colorKey = f.multi_color_hexes
        ? `multi:${f.multi_color_hexes}:${f.multi_color_direction ?? ""}`
        : f.color_hex ?? "none";
      const key = `${material}::${colorKey}`;

      const existing = groupMap.get(key);
      const remainingWeight = spool.remaining_weight ?? 0;
      const filamentWeight = f.weight ?? 0;

      if (existing) {
        existing.spool_count += 1;
        existing.total_remaining_weight += remainingWeight;
        existing.total_filament_weight += filamentWeight;
      } else {
        groupMap.set(key, {
          key,
          material,
          color_hex: f.color_hex,
          multi_color_hexes: f.multi_color_hexes,
          multi_color_direction: f.multi_color_direction,
          name: f.name,
          vendor_name: f.vendor?.name,
          spool_count: 1,
          total_remaining_weight: remainingWeight,
          total_filament_weight: filamentWeight,
        });
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => {
      const matCmp = a.material.localeCompare(b.material);
      if (matCmp !== 0) return matCmp;
      return getColorLabel(a).localeCompare(getColorLabel(b));
    });

    const totalRemainingWeight = nonArchived.reduce((sum: number, s: ISpool) => sum + (s.remaining_weight ?? 0), 0);
    const totalSpools = nonArchived.length;

    return { groups, totalRemainingWeight, totalSpools };
  }, [spoolsResult]);

  const columns = [
    {
      title: "Material",
      dataIndex: "material",
      key: "material",
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: "Colour",
      key: "colour",
      render: (_: unknown, record: FilamentGroup) => {
        const colorDisplay = getColorDisplay(record);
        return (
          <Row wrap={false} align="middle" gutter={8}>
            {colorDisplay && (
              <Col flex="none">
                <SpoolIcon color={colorDisplay} />
              </Col>
            )}
            <Col flex="auto">
              <Text code style={{ fontSize: 12 }}>
                {getColorLabel(record)}
              </Text>
            </Col>
          </Row>
        );
      },
    },
    {
      title: "Filament",
      key: "filament",
      render: (_: unknown, record: FilamentGroup) => {
        const parts = [record.vendor_name, record.name].filter(Boolean);
        return parts.length > 0 ? <Text>{parts.join(" – ")}</Text> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: "Spools",
      dataIndex: "spool_count",
      key: "spool_count",
      align: "right" as const,
      render: (value: number) => <Text>{value}</Text>,
    },
    {
      title: "Remaining Weight",
      key: "remaining_weight",
      align: "right" as const,
      render: (_: unknown, record: FilamentGroup) => {
        const maxPossible = record.total_filament_weight;
        const pct = maxPossible > 0 ? Math.min(100, (record.total_remaining_weight / maxPossible) * 100) : 0;
        return (
          <Row align="middle" gutter={12} wrap={false} style={{ minWidth: 180 }}>
            <Col flex="80px" style={{ textAlign: "right" }}>
              <Text strong>{record.total_remaining_weight.toFixed(0)} g</Text>
            </Col>
            <Col flex="auto">
              <Progress
                percent={Math.round(pct)}
                size="small"
                strokeColor={record.color_hex ? `#${record.color_hex.replace("#", "")}` : token.colorPrimary}
                showInfo={false}
                style={{ marginBottom: 0 }}
              />
            </Col>
          </Row>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <Content style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <Spin size="large" />
      </Content>
    );
  }

  return (
    <Content
      style={{
        padding: "2em 20px",
        maxWidth: 1100,
        margin: "0 auto",
        backgroundColor: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        color: token.colorText,
        fontFamily: token.fontFamily,
      }}
    >
      <Title
        level={2}
        style={{ display: "flex", alignItems: "center", gap: "0.4em", marginBottom: "1.5em" }}
      >
        <HighlightOutlined />
        Filament Overview
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: "2em" }}>
        <Col xs={12} md={8}>
          <Card>
            <Statistic title="Active Spools" value={totalSpools} />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card>
            <Statistic
              title="Total Remaining Filament"
              value={(totalRemainingWeight / 1000).toFixed(2)}
              suffix="kg"
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Filament Groups" value={groups.length} />
          </Card>
        </Col>
      </Row>

      <Table<FilamentGroup>
        dataSource={groups}
        columns={columns}
        rowKey="key"
        pagination={false}
        bordered
        sticky
        scroll={{ x: "max-content" }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}>
                <Text strong>Total</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <Text strong>{totalSpools}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <Text strong>{totalRemainingWeight.toFixed(0)} g</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </Content>
  );
};

export default Overview;
