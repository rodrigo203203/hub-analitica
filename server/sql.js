import sql from 'mssql';

const sqlConfig = {
    server: process.env.SQL_SERVER,
    port: Number(process.env.SQL_PORT || 1433),
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE !== 'false'
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise;

export function hasSqlConfig() {
    return Boolean(sqlConfig.server && sqlConfig.database && sqlConfig.user && sqlConfig.password);
}

export async function getPool() {
    if (!hasSqlConfig()) return null;
    if (!poolPromise) poolPromise = sql.connect(sqlConfig);
    return poolPromise;
}

function normalizeArrayFilter(value, allValue) {
    if (Array.isArray(value)) {
        const clean = value
            .map((v) => String(v || '').trim())
            .filter(Boolean)
            .filter((v) => v !== allValue);

        return clean.length ? clean : null;
    }

    if (value === allValue) return null;
    if (value === undefined || value === null || value === '') return null;

    return value;
}

function expandInFilter({
                            finalText,
                            request,
                            values,
                            key,
                            sqlType,
                            regex,
                            fieldBuilder
                        }) {
    if (Array.isArray(values) && values.length > 0) {
        const paramNames = values.map((_, i) => `@${key}${i}`);
        const inClause = paramNames.join(', ');

        finalText = finalText.replace(regex, (_match, prefix) => {
            const field = fieldBuilder(prefix || '');
            return `(${field} IN (${inClause}))`;
        });

        values.forEach((val, i) => {
            request.input(`${key}${i}`, sqlType, val);
        });

        return finalText;
    }

    request.input(key, sqlType, values ?? null);
    return finalText;
}

/**
 * Ejecuta una query parametrizada.
 * Soporta filtros múltiples:
 * - producto: ['CONSUMO', 'VIVIENDA']
 * - sucursal: ['LA PAZ', 'SANTA CRUZ']
 *
 * Si viene 'TODOS' o 'TODAS', no aplica filtro.
 */
export async function query(text, inputs = {}) {
    const pool = await getPool();
    if (!pool) return null;

    const request = pool.request();
    let finalText = text;

    const productos = normalizeArrayFilter(inputs.producto, 'TODOS');
    const sucursales = normalizeArrayFilter(inputs.sucursal, 'TODAS');

    const inputsRest = {...inputs};
    delete inputsRest.producto;
    delete inputsRest.sucursal;

    finalText = expandInFilter({
        finalText,
        request,
        values: productos,
        key: 'producto',
        sqlType: sql.NVarChar,
        regex: /\(\s*@producto\s+IS\s+NULL\s+OR\s+(\w+\.)?segmentacioncredito\s*=\s*@producto\s*\)/gi,
        fieldBuilder: (prefix) => `${prefix}segmentacioncredito`
    });

    finalText = expandInFilter({
        finalText,
        request,
        values: sucursales,
        key: 'sucursal',
        sqlType: sql.NVarChar,
        regex: /\(\s*@sucursal\s+IS\s+NULL\s+OR\s+(\w+\.)?Sucursal\s*=\s*@sucursal\s*\)/gi,
        fieldBuilder: (prefix) => `${prefix}Sucursal`
    });

    Object.entries(inputsRest).forEach(([key, value]) => {
        request.input(key, value ?? null);
    });

    return request.query(finalText);
}

export const queries = {
    summary: `
        WITH FechaActual AS (SELECT COALESCE(CAST(@fecha AS DATE), MAX(fechadata)) AS FechaReferencia
                             FROM Hub_CarteraBNB
                             WHERE (@fecha IS NULL OR fechadata = @fecha)),
             FechaBase AS (SELECT MAX(fechadata) AS FechaReferencia
                           FROM Hub_CarteraBNB
                           WHERE fechadata <= '2025-12-31'),
             Actual AS (SELECT SUM(s.stock)        AS StockActualUSD,
                               SUM(s.Desembolso)   AS DesembolsoMesUSD,
                               SUM(s.pendiente)    AS PendienteUSD,
                               SUM(s.presupuesto)  AS PresupuestoStockUSD,
                               SUM(s.amortizacion) AS AmortizacionMesUSD
                        FROM Hub_CarteraBNB s
                                 INNER JOIN FechaActual fa ON s.fechadata = fa.FechaReferencia
                                 INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
                        WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
                          AND (@producto IS NULL OR s.segmentacioncredito = @producto)),
             AcumuladoAnio AS (SELECT SUM(s.Desembolso)   AS DesembolsoAcumuladoAnioUSD,
                                      SUM(s.amortizacion) AS AmortizacionAcumuladaAnioUSD
                               FROM Hub_CarteraBNB s
                                        INNER JOIN FechaActual fa
                                                   ON s.fechadata >= DATEFROMPARTS(YEAR(fa.FechaReferencia), 1, 1)
                                                       AND s.fechadata <= fa.FechaReferencia
                                        INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
                               WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
                                 AND (@producto IS NULL OR s.segmentacioncredito = @producto)),
             Base AS (SELECT SUM(s.stock) AS StockBaseUSD
                      FROM Hub_CarteraBNB s
                               INNER JOIN FechaBase fb ON s.fechadata = fb.FechaReferencia
                               INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
                      WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
                        AND (@producto IS NULL OR s.segmentacioncredito = @producto))
        SELECT (SELECT FechaReferencia FROM FechaActual) AS FechaCorte,
               a.StockActualUSD,
               b.StockBaseUSD,
               aa.DesembolsoAcumuladoAnioUSD             AS DesembolsoUSD,
               a.DesembolsoMesUSD,
               a.PendienteUSD,
               a.PresupuestoStockUSD,
               aa.AmortizacionAcumuladaAnioUSD           AS AmortizacionUSD,
               a.AmortizacionMesUSD,
               a.StockActualUSD - b.StockBaseUSD         AS CrecimientoNominalUSD,
               CASE
                   WHEN b.StockBaseUSD IS NULL OR b.StockBaseUSD = 0 THEN NULL
                   ELSE ((a.StockActualUSD * 1.0 / b.StockBaseUSD) - 1) * 100
                   END                                   AS CrecimientoPct,
               CASE
                   WHEN a.PresupuestoStockUSD IS NULL OR a.PresupuestoStockUSD = 0 THEN NULL
                   ELSE (a.StockActualUSD * 1.0 / a.PresupuestoStockUSD) * 100
                   END                                   AS CumplimientoStockPct,
               a.StockActualUSD - a.PresupuestoStockUSD  AS BrechaPresupuestoUSD
        FROM Actual a
                 CROSS JOIN Base b
                 CROSS JOIN AcumuladoAnio aa;
    `,

    timeseries: `
        SELECT s.fechadata,
               SUM(s.stock)        AS StockActualUSD,
               SUM(s.Desembolso)   AS DesembolsoUSD,
               SUM(s.presupuesto)  AS PresupuestoStockUSD,
               SUM(s.amortizacion) AS AmortizacionUSD,
               CASE
                   WHEN SUM(s.presupuesto) IS NULL OR SUM(s.presupuesto) = 0 THEN NULL
                   ELSE (SUM(s.stock) * 1.0 / SUM(s.presupuesto)) * 100
                   END             AS CumplimientoStockPct
        FROM Hub_CarteraBNB s
                 INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
        WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
          AND (@producto IS NULL OR s.segmentacioncredito = @producto)
        GROUP BY s.fechadata
        ORDER BY s.fechadata ASC;
    `,kpisByProduct: `
  WITH FechaActual AS (
    SELECT COALESCE(CAST(@fecha AS DATE), MAX(fechadata)) AS FechaReferencia
    FROM Hub_CarteraBNB
    WHERE (@fecha IS NULL OR fechadata = @fecha)
  ),
  FechaBase AS (
    SELECT MAX(fechadata) AS FechaReferencia
    FROM Hub_CarteraBNB
    WHERE fechadata <= '2025-12-31'
  ),
  Actual AS (
    SELECT
      s.segmentacioncredito AS Producto,
      SUM(s.stock) AS StockActualUSD,
      SUM(s.presupuesto) AS PresupuestoStockUSD,
      SUM(s.pendiente) AS PendienteUSD
    FROM Hub_CarteraBNB s
    INNER JOIN FechaActual fa ON s.fechadata = fa.FechaReferencia
    INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
    WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
      AND (@producto IS NULL OR s.segmentacioncredito = @producto)
    GROUP BY s.segmentacioncredito
  ),
  AcumuladoAnio AS (
    SELECT
      s.segmentacioncredito AS Producto,
      SUM(s.Desembolso) AS DesembolsoAcumuladoAnioUSD,
      SUM(s.amortizacion) AS AmortizacionAcumuladaAnioUSD
    FROM Hub_CarteraBNB s
    INNER JOIN FechaActual fa
      ON s.fechadata >= DATEFROMPARTS(YEAR(fa.FechaReferencia), 1, 1)
     AND s.fechadata <= fa.FechaReferencia
    INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
    WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
      AND (@producto IS NULL OR s.segmentacioncredito = @producto)
    GROUP BY s.segmentacioncredito
  ),
  Base AS (
    SELECT
      s.segmentacioncredito AS Producto,
      SUM(s.stock) AS StockBaseUSD
    FROM Hub_CarteraBNB s
    INNER JOIN FechaBase fb ON s.fechadata = fb.FechaReferencia
    INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
    WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
      AND (@producto IS NULL OR s.segmentacioncredito = @producto)
    GROUP BY s.segmentacioncredito
  )
  SELECT
    a.Producto,
    a.StockActualUSD,
    b.StockBaseUSD,
    aa.DesembolsoAcumuladoAnioUSD,
    aa.AmortizacionAcumuladaAnioUSD,
    a.PresupuestoStockUSD,
    a.PendienteUSD,
    CASE
      WHEN b.StockBaseUSD IS NULL OR b.StockBaseUSD = 0 THEN NULL
      ELSE ((a.StockActualUSD * 1.0 / b.StockBaseUSD) - 1) * 100
    END AS CrecimientoPct,
    CASE
      WHEN a.PresupuestoStockUSD IS NULL OR a.PresupuestoStockUSD = 0 THEN NULL
      ELSE (a.StockActualUSD * 1.0 / a.PresupuestoStockUSD) * 100
    END AS CumplimientoStockPct
  FROM Actual a
  LEFT JOIN Base b ON b.Producto = a.Producto
  LEFT JOIN AcumuladoAnio aa ON aa.Producto = a.Producto
  ORDER BY a.StockActualUSD DESC;
`,

    benchmark: `
        WITH FechaActual AS (SELECT MAX(fechadata) AS FechaReferencia
                             FROM Hub_CarteraSF
                             WHERE (@fecha IS NULL OR fechadata = @fecha)),
             BaseDic AS (SELECT MAX(fechadata) AS FechaReferencia
                         FROM Hub_CarteraSF
                         WHERE fechadata <= '2025-12-31'),
             Actual AS (SELECT sf.banco,
                               sf.Sucursal,
                               sf.segmentacioncredito,
                               SUM(sf.monto) AS MontoActualUSD
                        FROM Hub_CarteraSF sf
                                 INNER JOIN FechaActual fa ON sf.fechadata = fa.FechaReferencia
                        WHERE (@banco IS NULL OR sf.banco = @banco)
                          AND (@sucursal IS NULL OR sf.Sucursal = @sucursal)
                          AND (@producto IS NULL OR sf.segmentacioncredito = @producto)
                        GROUP BY sf.banco, sf.Sucursal, sf.segmentacioncredito),
             Base AS (SELECT sf.banco,
                             sf.Sucursal,
                             sf.segmentacioncredito,
                             SUM(sf.monto) AS MontoBaseUSD
                      FROM Hub_CarteraSF sf
                               INNER JOIN BaseDic bd ON sf.fechadata = bd.FechaReferencia
                      WHERE (@banco IS NULL OR sf.banco = @banco)
                        AND (@sucursal IS NULL OR sf.Sucursal = @sucursal)
                        AND (@producto IS NULL OR sf.segmentacioncredito = @producto)
                      GROUP BY sf.banco, sf.Sucursal, sf.segmentacioncredito)
        SELECT a.banco,
               a.Sucursal,
               a.segmentacioncredito,
               a.MontoActualUSD,
               CASE
                   WHEN b.MontoBaseUSD IS NULL OR b.MontoBaseUSD = 0 THEN NULL
                   ELSE ((a.MontoActualUSD * 1.0 / b.MontoBaseUSD) - 1) * 100
                   END AS CrecimientoPct
        FROM Actual a
                 LEFT JOIN Base b
                           ON b.banco = a.banco
                               AND b.Sucursal = a.Sucursal
                               AND b.segmentacioncredito = a.segmentacioncredito
        ORDER BY a.banco, a.Sucursal, a.segmentacioncredito;
    `,

    marketShare: `
        WITH FechaActual AS (SELECT MAX(fechadata) AS FechaReferencia
                             FROM Hub_CarteraSF
                             WHERE (@fecha IS NULL OR fechadata = @fecha))
        SELECT sf.segmentacioncredito,
               SUM(CASE WHEN sf.banco = 'BNB' THEN sf.monto ELSE 0 END) AS MontoBNBUSD,
               SUM(sf.monto)                                            AS MontoSistemaFinancieroUSD,
               CASE
                   WHEN SUM(sf.monto) IS NULL OR SUM(sf.monto) = 0 THEN NULL
                   ELSE (SUM(CASE WHEN sf.banco = 'BNB' THEN sf.monto ELSE 0 END) * 1.0 / SUM(sf.monto)) * 100
                   END                                                  AS ParticipacionBNBPct
        FROM Hub_CarteraSF sf
                 INNER JOIN FechaActual fa ON sf.fechadata = fa.FechaReferencia
        WHERE (@sucursal IS NULL OR sf.Sucursal = @sucursal)
          AND (@producto IS NULL OR sf.segmentacioncredito = @producto)
        GROUP BY sf.segmentacioncredito
        ORDER BY ParticipacionBNBPct DESC;
    `,

    oficiales: `
        WITH FechaActual AS (SELECT MAX(FechaData) AS FechaReferencia
                             FROM Hub_OONN
                             WHERE (@fecha IS NULL OR FechaData = @fecha))
        SELECT d.Sucursal,
               o.Oficial,
               SUM(o.MontoDesembolsoDolares) AS DesembolsoOficialUSD
        FROM Hub_OONN o
                 INNER JOIN DimAgencia d ON d.Cod_Agencia = o.ID_AGENCIA
                 INNER JOIN FechaActual fa ON o.FechaData = fa.FechaReferencia
        WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
        GROUP BY d.Sucursal, o.Oficial
        ORDER BY DesembolsoOficialUSD DESC;
    `,

    status: `
        SELECT 'Hub_CarteraBNB' AS Fuente, MAX(fechadata) AS FechaCorte
        FROM Hub_CarteraBNB
        UNION ALL
        SELECT 'Hub_CarteraSF' AS Fuente, MAX(fechadata) AS FechaCorte
        FROM Hub_CarteraSF
        UNION ALL
        SELECT 'Hub_OONN' AS Fuente, MAX(FechaData) AS FechaCorte
        FROM Hub_OONN;
    `
};