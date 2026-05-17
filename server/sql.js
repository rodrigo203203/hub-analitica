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
    try {
        if (!poolPromise) {
            poolPromise = sql.connect(sqlConfig).catch(err => {
                console.error("SQL Connection Error:", err.message);
                poolPromise = null; // Permite reintentar en la próxima llamada
                throw err;
            });
        }
        return await poolPromise;
    } catch (error) {
        return null;
    }
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
        let matched = false;

        finalText = finalText.replace(regex, (_match, prefix) => {
            matched = true;
            const field = fieldBuilder(prefix || '');
            return `(${field} IN (${inClause}))`;
        });

        if (matched) {
            values.forEach((val, i) => {
                request.input(`${key}${i}`, sqlType, val);
            });
        }

        return finalText;
    }

    request.input(key, sqlType, values ?? null);
    return finalText;
}

/**
 * Ejecuta una query parametrizada.
 * Soporta filtros múltiples (producto, sucursal, agencia) y sentinela TODOS/TODAS.
 * El filtro agencia no aplica a Hub_CarteraSF (benchmark / market share).
 */

export async function query(text, inputs = {}) {
    const pool = await getPool();
    if (!pool) return null;

    const request = pool.request();
    let finalText = text;

    const productos = normalizeArrayFilter(inputs.producto, 'TODOS');
    const sucursales = normalizeArrayFilter(inputs.sucursal, 'TODAS');
    const agencias = normalizeArrayFilter(inputs.agencia, 'TODAS');

    const inputsRest = {...inputs};
    delete inputsRest.producto;
    delete inputsRest.sucursal;
    delete inputsRest.agencia;

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

    finalText = expandInFilter({
        finalText,
        request,
        values: agencias,
        key: 'agencia',
        sqlType: sql.NVarChar,
        regex: /\(\s*@agencia\s+IS\s+NULL\s+OR\s+d\.Cod_Agencia\s*=\s*@agencia\s*\)/gi,
        fieldBuilder: () => 'd.Cod_Agencia'
    });

    Object.entries(inputsRest).forEach(([inKey, value]) => {
        request.input(inKey, value ?? null);
    });

    return request.query(finalText);
}

export async function fetchProjectionFromSql(scenario = 'base', inputs = {}) {
    const pool = await getPool();
    if (!pool) return null;

    const desembolsoScenarioColumn = projectionScenarioColumn(scenario);
    const amortizacionScenarioColumn = projectionAmortizacionScenarioColumn(scenario);

    const productos = normalizeArrayFilter(inputs.producto, 'TODOS');
    const sucursales = normalizeArrayFilter(inputs.sucursal, 'TODAS');
    const agencias = normalizeArrayFilter(inputs.agencia, 'TODAS');

    const request = pool.request();

    request.input('fecha', inputs.fecha ?? null);

    let productFilterDes = '';
    let productFilterAmo = '';

    if (Array.isArray(productos) && productos.length > 0) {
        const params = productos.map((_, i) => `@producto${i}`).join(', ');
        productFilterDes = ` AND pd.PRODUCTO IN (${params})`;
        productFilterAmo = ` AND pa.PRODUCTO IN (${params})`;

        productos.forEach((value, i) => {
            request.input(`producto${i}`, sql.NVarChar, value);
        });
    }

    let agencyFilterDes = '';
    let agencyFilterAmo = '';

    if (Array.isArray(agencias) && agencias.length > 0) {
        const params = agencias.map((_, i) => `@agencia${i}`).join(', ');
        agencyFilterDes = ` AND pd.agencia IN (${params})`;
        agencyFilterAmo = ` AND pa.agencia IN (${params})`;

        agencias.forEach((value, i) => {
            request.input(`agencia${i}`, sql.NVarChar, value);
        });
    }

    let sucursalJoinDes = '';
    let sucursalJoinAmo = '';
    let sucursalFilterDes = '';
    let sucursalFilterAmo = '';

    if (Array.isArray(sucursales) && sucursales.length > 0) {
        sucursalJoinDes = ` INNER JOIN DimAgencia dd ON dd.Cod_Agencia = pd.agencia `;
        sucursalJoinAmo = ` INNER JOIN DimAgencia da ON da.Cod_Agencia = pa.agencia `;

        const params = sucursales.map((_, i) => `@sucursal${i}`).join(', ');
        sucursalFilterDes = ` AND dd.Sucursal IN (${params})`;
        sucursalFilterAmo = ` AND da.Sucursal IN (${params})`;

        sucursales.forEach((value, i) => {
            request.input(`sucursal${i}`, sql.NVarChar, value);
        });
    }

    const result = await request.query(`
        ;WITH Desembolsos AS (
            SELECT
                pd.Fecha,
                pd.PRODUCTO,
                pd.TIPO_DATO,
                SUM(
                    CASE
                        WHEN pd.TIPO_DATO = 'HISTORICO' THEN ISNULL(pd.Desembolso, 0)
                        WHEN pd.TIPO_DATO = 'PROYECCION' THEN ISNULL(pd.${desembolsoScenarioColumn}, 0)
                        ELSE 0
                    END
                ) AS DesembolsoUSD
            FROM Hub_ProyeccionDesembolso pd
            ${sucursalJoinDes}
            WHERE 1 = 1
              AND (@fecha IS NULL OR pd.Fecha >= DATEFROMPARTS(YEAR(CAST(@fecha AS DATE)), 1, 1))
              ${productFilterDes}
              ${agencyFilterDes}
              ${sucursalFilterDes}
            GROUP BY
                pd.Fecha,
                pd.PRODUCTO,
                pd.TIPO_DATO
        ),
        Amortizaciones AS (
            SELECT
                pa.Fecha,
                pa.PRODUCTO,
                pa.TIPO_DATO,
                SUM(
                    CASE
                        WHEN pa.TIPO_DATO = 'HISTORICO' THEN ISNULL(pa.amortizacion, 0)
                        WHEN pa.TIPO_DATO = 'PROYECCION' THEN ISNULL(pa.${amortizacionScenarioColumn}, 0)
                        ELSE 0
                    END
                ) AS AmortizacionUSD
            FROM Hub_ProyeccionAmortizacion pa
            ${sucursalJoinAmo}
            WHERE 1 = 1
              AND (@fecha IS NULL OR pa.Fecha >= DATEFROMPARTS(YEAR(CAST(@fecha AS DATE)), 1, 1))
              ${productFilterAmo}
              ${agencyFilterAmo}
              ${sucursalFilterAmo}
            GROUP BY
                pa.Fecha,
                pa.PRODUCTO,
                pa.TIPO_DATO
        )
        SELECT
            COALESCE(d.Fecha, a.Fecha) AS Fecha,
            COALESCE(d.PRODUCTO, a.PRODUCTO) AS Producto,
            COALESCE(d.TIPO_DATO, a.TIPO_DATO) AS TipoDato,
            SUM(ISNULL(d.DesembolsoUSD, 0)) AS DesembolsoUSD,
            SUM(ISNULL(a.AmortizacionUSD, 0)) AS AmortizacionUSD
        FROM Desembolsos d
        FULL OUTER JOIN Amortizaciones a
            ON a.Fecha = d.Fecha
           AND a.PRODUCTO = d.PRODUCTO
           AND a.TIPO_DATO = d.TIPO_DATO
        GROUP BY
            COALESCE(d.Fecha, a.Fecha),
            COALESCE(d.PRODUCTO, a.PRODUCTO),
            COALESCE(d.TIPO_DATO, a.TIPO_DATO)
        ORDER BY
            Fecha ASC,
            Producto ASC;
    `);

    return result;
}

export async function fetchProjectionByProductFromSql(scenario = 'base', product, inputs = {}) {
    const response = await fetchProjectionFromSql(scenario, {
        ...inputs,
        producto: product ? [product] : inputs.producto
    });

    return response;
}

export async function fetchPdRiskHistoryFromSql(inputs = {}) {
    const pool = await getPool();
    if (!pool) return null;

    const productos = normalizeArrayFilter(inputs.producto, 'TODOS');
    const sucursales = normalizeArrayFilter(inputs.sucursal, 'TODAS');
    const agencias = normalizeArrayFilter(inputs.agencia, 'TODAS');

    const request = pool.request();

    let productFilter = '';
    if (Array.isArray(productos) && productos.length > 0) {
        const params = productos.map((_, i) => `@producto${i}`).join(', ');
        productFilter = ` AND pd.SegmentacionCredito IN (${params})`;

        productos.forEach((value, i) => {
            request.input(`producto${i}`, sql.NVarChar, value);
        });
    }

    let sucursalFilter = '';
    if (Array.isArray(sucursales) && sucursales.length > 0) {
        const params = sucursales.map((_, i) => `@sucursal${i}`).join(', ');
        sucursalFilter = ` AND d.Sucursal IN (${params})`;

        sucursales.forEach((value, i) => {
            request.input(`sucursal${i}`, sql.NVarChar, value);
        });
    }

    let agenciaFilter = '';
    if (Array.isArray(agencias) && agencias.length > 0) {
        const params = agencias.map((_, i) => `@agencia${i}`).join(', ');

        agenciaFilter = ` AND TRY_CAST(pd.agencia AS INT) IN (${params})`;

        agencias.forEach((value, i) => {
            request.input(`agencia${i}`, sql.Int, Number(value));
        });
    }

    const result = await request.query(`
        SELECT CAST(pd.fecha AS DATE)      AS Fecha,
               pd.SegmentacionCredito      AS Producto,
               TRY_CAST(pd.agencia AS INT) AS Cod_Agencia,
               d.Agencia                   AS NombreAgencia,
               d.Sucursal,
               SUM(ISNULL(pd.Alta, 0))     AS Alto,
               SUM(ISNULL(pd.Media, 0))    AS Media,
               SUM(ISNULL(pd.Baja, 0))     AS Baja
        FROM Hub_PD pd
                 LEFT JOIN DimAgencia d
                           ON d.Cod_Agencia = TRY_CAST(pd.agencia AS INT)
        WHERE 1 = 1
            ${productFilter} ${sucursalFilter} ${agenciaFilter}
        GROUP BY
            CAST (pd.fecha AS DATE),
            pd.SegmentacionCredito,
            TRY_CAST(pd.agencia AS INT),
            d.Agencia,
            d.Sucursal
        ORDER BY
            CAST (pd.fecha AS DATE) ASC,
            pd.SegmentacionCredito ASC;
    `);

    return result;
}

export async function fetchPdRiskFromSql(inputs = {}) {
    const pool = await getPool();
    if (!pool) return null;

    const productos = normalizeArrayFilter(inputs.producto, 'TODOS');
    const sucursales = normalizeArrayFilter(inputs.sucursal, 'TODAS');
    const agencias = normalizeArrayFilter(inputs.agencia, 'TODAS');

    const request = pool.request();

    request.input('fecha', inputs.fecha ?? null);

    let productFilter = '';
    if (Array.isArray(productos) && productos.length > 0) {
        const params = productos.map((_, i) => `@producto${i}`).join(', ');
        productFilter = ` AND pd.SegmentacionCredito IN (${params})`;

        productos.forEach((value, i) => {
            request.input(`producto${i}`, sql.NVarChar, value);
        });
    }

    let sucursalFilter = '';
    if (Array.isArray(sucursales) && sucursales.length > 0) {
        const params = sucursales.map((_, i) => `@sucursal${i}`).join(', ');
        sucursalFilter = ` AND d.Sucursal IN (${params})`;

        sucursales.forEach((value, i) => {
            request.input(`sucursal${i}`, sql.NVarChar, value);
        });
    }

    let agenciaFilter = '';
    if (Array.isArray(agencias) && agencias.length > 0) {
        const params = agencias.map((_, i) => `@agencia${i}`).join(', ');
        agenciaFilter = ` AND TRY_CAST(pd.agencia AS INT) IN (${params})`;

        agencias.forEach((value, i) => {
            request.input(`agencia${i}`, sql.Int, Number(value));
        });
    }

    const result = await request.query(`
        ;WITH FechaActual AS (
            SELECT
                COALESCE(
                    CAST(@fecha AS DATE),
                    (SELECT MAX(CAST(fecha AS DATE)) FROM Hub_PD)
                ) AS FechaReferencia
        ),
        Base AS (
            SELECT
                CAST(pd.fecha AS DATE) AS Fecha,
                pd.SegmentacionCredito AS Producto,
                TRY_CAST(pd.agencia AS INT) AS Cod_Agencia,
                d.Agencia AS NombreAgencia,
                d.Sucursal,
                SUM(ISNULL(pd.Alta, 0)) AS Alto,
                SUM(ISNULL(pd.Media, 0)) AS Media,
                SUM(ISNULL(pd.Baja, 0)) AS Baja
            FROM Hub_PD pd
            INNER JOIN FechaActual fa
                ON CAST(pd.fecha AS DATE) = fa.FechaReferencia
            LEFT JOIN DimAgencia d
                ON d.Cod_Agencia = TRY_CAST(pd.agencia AS INT)
            WHERE 1 = 1
              ${productFilter}
              ${sucursalFilter}
              ${agenciaFilter}
            GROUP BY
                CAST(pd.fecha AS DATE),
                pd.SegmentacionCredito,
                TRY_CAST(pd.agencia AS INT),
                d.Agencia,
                d.Sucursal
        )
        SELECT
            Fecha,
            Producto,
            Cod_Agencia,
            NombreAgencia,
            Sucursal,
            Alto,
            Media,
            Baja,
            Alto + Media + Baja AS TotalOperaciones,
            CASE
                WHEN Alto + Media + Baja = 0 THEN NULL
                ELSE Alto * 100.0 / (Alto + Media + Baja)
            END AS AltoPct,
            CASE
                WHEN Alto + Media + Baja = 0 THEN NULL
                ELSE Media * 100.0 / (Alto + Media + Baja)
            END AS MediaPct,
            CASE
                WHEN Alto + Media + Baja = 0 THEN NULL
                ELSE Baja * 100.0 / (Alto + Media + Baja)
            END AS BajaPct
        FROM Base
        ORDER BY
            Alto DESC,
            Media DESC,
            TotalOperaciones DESC;
    `);

    return result;
}

export async function fetchSharedPortfolioFromSql(inputs = {}) {
    const pool = await getPool();
    if (!pool) return null;

    const productos = normalizeArrayFilter(inputs.producto, 'TODOS');
    const sucursales = normalizeArrayFilter(inputs.sucursal, 'TODAS');
    const agencias = normalizeArrayFilter(inputs.agencia, 'TODAS');

    const request = pool.request();

    request.input('fecha', inputs.fecha ?? null);

    let productFilter = '';
    if (Array.isArray(productos) && productos.length > 0) {
        const params = productos.map((_, i) => `@producto${i}`).join(', ');
        productFilter = ` AND c.SEGMENTO IN (${params})`;

        productos.forEach((value, i) => {
            request.input(`producto${i}`, sql.NVarChar, value);
        });
    }

    let sucursalFilter = '';
    if (Array.isArray(sucursales) && sucursales.length > 0) {
        const params = sucursales.map((_, i) => `@sucursal${i}`).join(', ');
        sucursalFilter = ` AND d.Sucursal IN (${params})`;

        sucursales.forEach((value, i) => {
            request.input(`sucursal${i}`, sql.NVarChar, value);
        });
    }

    let agenciaFilter = '';
    if (Array.isArray(agencias) && agencias.length > 0) {
        const params = agencias.map((_, i) => `@agencia${i}`).join(', ');
        agenciaFilter = ` AND TRY_CAST(c.AGENCIA AS INT) IN (${params})`;

        agencias.forEach((value, i) => {
            request.input(`agencia${i}`, sql.Int, Number(value));
        });
    }

    const result = await request.query(`
        ;WITH FechaActual AS (
    SELECT
        COALESCE(
            (
                SELECT MAX(CAST(FECHA AS DATE))
                FROM Hub_CarteraSF_COMPARTIDA
                WHERE @fecha IS NOT NULL
                  AND CAST(FECHA AS DATE) <= CAST(@fecha AS DATE)
            ),
            (
                SELECT MAX(CAST(FECHA AS DATE))
                FROM Hub_CarteraSF_COMPARTIDA
            )
        ) AS FechaReferencia
),
        Base AS (
            SELECT
                CAST(c.FECHA AS DATE) AS Fecha,
                c.SEGMENTO AS Segmento,
                TRY_CAST(c.AGENCIA AS INT) AS Cod_Agencia,
                d.Agencia AS NombreAgencia,
                d.Sucursal,
                SUM(ISNULL(c.[Cli q], 0)) AS ClientesCompartidos,

                SUM(ISNULL(c.BNB, 0)) AS BNB,
                SUM(ISNULL(c.BIS, 0)) AS BIS,
                SUM(ISNULL(c.BCR, 0)) AS BCR,
                SUM(ISNULL(c.BEC, 0)) AS BEC,
                SUM(ISNULL(c.BIE, 0)) AS BIE,
                SUM(ISNULL(c.BGA, 0)) AS BGA,
                SUM(ISNULL(c.BME, 0)) AS BME,
                SUM(ISNULL(c.BSO, 0)) AS BSO,
                SUM(ISNULL(c.OTRO, 0)) AS OTRO
            FROM Hub_CarteraSF_COMPARTIDA c
            INNER JOIN FechaActual fa
                ON CAST(c.FECHA AS DATE) = fa.FechaReferencia
            LEFT JOIN DimAgencia d
                ON d.Cod_Agencia = TRY_CAST(c.AGENCIA AS INT)
            WHERE 1 = 1
              ${productFilter}
              ${sucursalFilter}
              ${agenciaFilter}
            GROUP BY
                CAST(c.FECHA AS DATE),
                c.SEGMENTO,
                TRY_CAST(c.AGENCIA AS INT),
                d.Agencia,
                d.Sucursal
        )
        SELECT
            Fecha,
            Segmento,
            Cod_Agencia,
            NombreAgencia,
            Sucursal,
            ClientesCompartidos,

            BNB,
            BIS,
            BCR,
            BEC,
            BIE,
            BGA,
            BME,
            BSO,
            OTRO,

            BIS + BCR + BEC + BIE + BGA + BME + BSO + OTRO AS OtrosBancos,
            BNB + BIS + BCR + BEC + BIE + BGA + BME + BSO + OTRO AS TotalCompartido,

            CASE
                WHEN BNB + BIS + BCR + BEC + BIE + BGA + BME + BSO + OTRO = 0 THEN NULL
                ELSE BNB * 100.0 / (BNB + BIS + BCR + BEC + BIE + BGA + BME + BSO + OTRO)
            END AS ParticipacionBNBPct,

            CASE
                WHEN BNB + BIS + BCR + BEC + BIE + BGA + BME + BSO + OTRO = 0 THEN NULL
                ELSE (BIS + BCR + BEC + BIE + BGA + BME + BSO + OTRO) * 100.0 /
                     (BNB + BIS + BCR + BEC + BIE + BGA + BME + BSO + OTRO)
            END AS ParticipacionOtrosPct
        FROM Base
        ORDER BY
            OtrosBancos DESC,
            ClientesCompartidos DESC;
    `);

    return result;
}

export async function fetchMaduracionFromSql(inputs = {}) {
    const pool = await getPool();
    if (!pool) return null;

    const productos = normalizeArrayFilter(inputs.producto, 'TODOS');
    const sucursales = normalizeArrayFilter(inputs.sucursal, 'TODAS');
    const agencias = normalizeArrayFilter(inputs.agencia, 'TODAS');

    const request = pool.request();
    request.input('fecha', inputs.fecha ?? null);

    let productFilter = '';
    if (Array.isArray(productos) && productos.length > 0) {
        const params = productos.map((_, i) => `@producto${i}`).join(', ');
        productFilter = ` AND m.SegmentacionCredito IN (${params})`;

        productos.forEach((value, i) => {
            request.input(`producto${i}`, sql.NVarChar, value);
        });
    }

    let sucursalFilter = '';
    if (Array.isArray(sucursales) && sucursales.length > 0) {
        const params = sucursales.map((_, i) => `@sucursal${i}`).join(', ');
        sucursalFilter = ` AND d.Sucursal IN (${params})`;

        sucursales.forEach((value, i) => {
            request.input(`sucursal${i}`, sql.NVarChar, value);
        });
    }

    let agenciaFilter = '';
    if (Array.isArray(agencias) && agencias.length > 0) {
        const params = agencias.map((_, i) => `@agencia${i}`).join(', ');
        agenciaFilter = ` AND m.idagencia IN (${params})`;

        agencias.forEach((value, i) => {
            request.input(`agencia${i}`, sql.Int, Number(value));
        });
    }

    const result = await request.query(`
        ;WITH FechaActual AS (
            SELECT
                COALESCE(
                    (
                        SELECT MAX(CAST(fechadata AS DATE))
                        FROM Hub_Maduracion
                        WHERE @fecha IS NOT NULL
                          AND CAST(fechadata AS DATE) <= CAST(@fecha AS DATE)
                    ),
                    (
                        SELECT MAX(CAST(fechadata AS DATE))
                        FROM Hub_Maduracion
                    )
                ) AS FechaReferencia
        ),
        Base AS (
            SELECT
                CAST(m.fechadata AS DATE) AS Fecha,
                m.idagencia AS Cod_Agencia,
                d.Agencia AS NombreAgencia,
                d.Sucursal,
                m.SegmentacionCredito AS Producto,

                SUM(ISNULL(m.Stock, 0)) AS StockUSD,
                SUM(ISNULL(m.MontoDesembolsoDolares, 0)) AS MontoDesembolsoUSD,

                CASE
                    WHEN SUM(ISNULL(m.Stock, 0)) = 0 THEN NULL
                    ELSE
                        SUM(ISNULL(m.Maduracion, 0) * ISNULL(m.Stock, 0)) * 100.0
                        / SUM(ISNULL(m.Stock, 0))
                END AS MaduracionPct
            FROM Hub_Maduracion m
            INNER JOIN FechaActual fa
                ON CAST(m.fechadata AS DATE) = fa.FechaReferencia
            LEFT JOIN DimAgencia d
                ON d.Cod_Agencia = m.idagencia
            WHERE 1 = 1
              ${productFilter}
              ${sucursalFilter}
              ${agenciaFilter}
            GROUP BY
                CAST(m.fechadata AS DATE),
                m.idagencia,
                d.Agencia,
                d.Sucursal,
                m.SegmentacionCredito
        )
        SELECT
            Fecha,
            Cod_Agencia,
            NombreAgencia,
            Sucursal,
            Producto,
            StockUSD,
            MontoDesembolsoUSD,
            MaduracionPct,
            MontoDesembolsoUSD - StockUSD AS AmortizadoEstimadoUSD,
            CASE
                WHEN MontoDesembolsoUSD = 0 THEN NULL
                ELSE StockUSD * 100.0 / MontoDesembolsoUSD
            END AS SaldoSobreDesembolsoPct
        FROM Base
        ORDER BY
            MaduracionPct DESC,
            StockUSD DESC;
    `);

    return result;
}

export async function fetchLcfFromSql(inputs = {}) {
    const pool = await getPool();
    if (!pool) return null;

    const productos = normalizeArrayFilter(inputs.producto, 'TODOS');
    const sucursales = normalizeArrayFilter(inputs.sucursal, 'TODAS');
    const agencias = normalizeArrayFilter(inputs.agencia, 'TODAS');

    const request = pool.request();
    request.input('fecha', inputs.fecha ?? null);

    let productFilter = '';
    if (Array.isArray(productos) && productos.length > 0) {
        const params = productos.map((_, i) => `@producto${i}`).join(', ');
        productFilter = ` AND l.SegmentacionCredito IN (${params})`;

        productos.forEach((value, i) => {
            request.input(`producto${i}`, sql.NVarChar, value);
        });
    }

    let sucursalFilter = '';
    if (Array.isArray(sucursales) && sucursales.length > 0) {
        const params = sucursales.map((_, i) => `@sucursal${i}`).join(', ');
        sucursalFilter = ` AND d.Sucursal IN (${params})`;

        sucursales.forEach((value, i) => {
            request.input(`sucursal${i}`, sql.NVarChar, value);
        });
    }

    let agenciaFilter = '';
    if (Array.isArray(agencias) && agencias.length > 0) {
        const params = agencias.map((_, i) => `@agencia${i}`).join(', ');
        agenciaFilter = ` AND l.IdAgencia IN (${params})`;

        agencias.forEach((value, i) => {
            request.input(`agencia${i}`, sql.Int, Number(value));
        });
    }

    const result = await request.query(`
        ;WITH FechaActual AS (
            SELECT
                COALESCE(
                    (
                        SELECT MAX(CAST(FechaData AS DATE))
                        FROM Hub_LCF
                        WHERE @fecha IS NOT NULL
                          AND CAST(FechaData AS DATE) <= CAST(@fecha AS DATE)
                    ),
                    (
                        SELECT MAX(CAST(FechaData AS DATE))
                        FROM Hub_LCF
                    )
                ) AS FechaReferencia
        ),
        Base AS (
            SELECT
                CAST(l.FechaData AS DATE) AS Fecha,
                l.IdAgencia AS Cod_Agencia,
                d.Agencia AS NombreAgencia,
                d.Sucursal,
                l.SegmentacionCredito AS Producto,

                SUM(ISNULL(l.MontoDesembolsoDolares, 0)) AS MontoAutorizadoUSD,
                SUM(ISNULL(l.SaldoDeudorDolares, 0)) AS SaldoActivadoUSD
            FROM Hub_LCF l
            INNER JOIN FechaActual fa
                ON CAST(l.FechaData AS DATE) = fa.FechaReferencia
            LEFT JOIN DimAgencia d
                ON d.Cod_Agencia = l.IdAgencia
            WHERE 1 = 1
              ${productFilter}
              ${sucursalFilter}
              ${agenciaFilter}
            GROUP BY
                CAST(l.FechaData AS DATE),
                l.IdAgencia,
                d.Agencia,
                d.Sucursal,
                l.SegmentacionCredito
        )
        SELECT
            Fecha,
            Cod_Agencia,
            NombreAgencia,
            Sucursal,
            Producto,
            MontoAutorizadoUSD,
            SaldoActivadoUSD,
            MontoAutorizadoUSD - SaldoActivadoUSD AS CupoNoUtilizadoUSD,
            CASE
                WHEN MontoAutorizadoUSD = 0 THEN NULL
                ELSE SaldoActivadoUSD * 100.0 / MontoAutorizadoUSD
            END AS ActivacionPct,
            CASE
                WHEN MontoAutorizadoUSD = 0 THEN NULL
                ELSE (MontoAutorizadoUSD - SaldoActivadoUSD) * 100.0 / MontoAutorizadoUSD
            END AS CupoNoUtilizadoPct
        FROM Base
        ORDER BY
            CupoNoUtilizadoUSD DESC,
            MontoAutorizadoUSD DESC;
    `);

    return result;
}

export async function fetchCaptacionesFromSql(inputs = {}) {
    const pool = await getPool();
    if (!pool) return null;

    const sucursales = normalizeArrayFilter(inputs.sucursal, 'TODAS');
    const agencias = normalizeArrayFilter(inputs.agencia, 'TODAS');

    const request = pool.request();
    request.input('fecha', inputs.fecha ?? null);

    let sucursalFilter = '';
    if (Array.isArray(sucursales) && sucursales.length > 0) {
        const params = sucursales.map((_, i) => `@sucursal${i}`).join(', ');
        sucursalFilter = ` AND d.Sucursal IN (${params})`;

        sucursales.forEach((value, i) => {
            request.input(`sucursal${i}`, sql.NVarChar, value);
        });
    }

    let agenciaFilter = '';
    if (Array.isArray(agencias) && agencias.length > 0) {
        const params = agencias.map((_, i) => `@agencia${i}`).join(', ');
        agenciaFilter = ` AND c.Codigo IN (${params})`;

        agencias.forEach((value, i) => {
            request.input(`agencia${i}`, sql.Int, Number(value));
        });
    }

    const result = await request.query(`
        ;WITH FechaActual AS (
            SELECT
                COALESCE(
                    (
                        SELECT MAX(CAST(Fecha AS DATE))
                        FROM Hub_Captaciones
                        WHERE @fecha IS NOT NULL
                          AND CAST(Fecha AS DATE) <= CAST(@fecha AS DATE)
                    ),
                    (
                        SELECT MAX(CAST(Fecha AS DATE))
                        FROM Hub_Captaciones
                    )
                ) AS FechaReferencia
        ),
        Base AS (
            SELECT
                CAST(c.Fecha AS DATE) AS Fecha,
                c.Codigo AS Cod_Agencia,
                d.Agencia AS NombreAgencia,
                d.Sucursal,

                SUM(ISNULL(c.Ejecutada_Captaciones, 0)) AS EjecutadaCaptaciones,
                SUM(ISNULL(c.Presupuestada_Captaciones, 0)) AS PresupuestadaCaptaciones,

                SUM(ISNULL(c.Ejecutada_Vista, 0)) AS EjecutadaVista,
                SUM(ISNULL(c.Presupuestada_Vista, 0)) AS PresupuestadaVista,

                SUM(ISNULL(c.Ejecutada_Ahorros, 0)) AS EjecutadaAhorros,
                SUM(ISNULL(c.Presupuestada_Ahorros, 0)) AS PresupuestadaAhorros,

                SUM(ISNULL(c.Ejecutada_Plazo, 0)) AS EjecutadaPlazo,
                SUM(ISNULL(c.Presupuestada_Plazo, 0)) AS PresupuestadaPlazo,

                SUM(ISNULL(c.Tendencia_Captaciones, 0)) AS TendenciaCaptaciones,
                MAX(c.Categoria_Tendencia) AS CategoriaTendencia
            FROM Hub_Captaciones c
            INNER JOIN FechaActual fa
                ON CAST(c.Fecha AS DATE) = fa.FechaReferencia
            LEFT JOIN DimAgencia d
                ON d.Cod_Agencia = c.Codigo
            WHERE 1 = 1
              ${sucursalFilter}
              ${agenciaFilter}
            GROUP BY
                CAST(c.Fecha AS DATE),
                c.Codigo,
                d.Agencia,
                d.Sucursal
        )
        SELECT
            Fecha,
            Cod_Agencia,
            NombreAgencia,
            Sucursal,

            EjecutadaCaptaciones,
            PresupuestadaCaptaciones,
            EjecutadaCaptaciones - PresupuestadaCaptaciones AS BrechaCaptaciones,

            EjecutadaVista,
            PresupuestadaVista,
            EjecutadaVista - PresupuestadaVista AS BrechaVista,

            EjecutadaAhorros,
            PresupuestadaAhorros,
            EjecutadaAhorros - PresupuestadaAhorros AS BrechaAhorros,

            EjecutadaPlazo,
            PresupuestadaPlazo,
            EjecutadaPlazo - PresupuestadaPlazo AS BrechaPlazo,

            TendenciaCaptaciones,
            CategoriaTendencia,

            CASE
                WHEN PresupuestadaCaptaciones = 0 THEN NULL
                ELSE EjecutadaCaptaciones * 100.0 / PresupuestadaCaptaciones
            END AS CumplimientoCaptacionesPct,

            CASE
                WHEN PresupuestadaVista = 0 THEN NULL
                ELSE EjecutadaVista * 100.0 / PresupuestadaVista
            END AS CumplimientoVistaPct,

            CASE
                WHEN PresupuestadaAhorros = 0 THEN NULL
                ELSE EjecutadaAhorros * 100.0 / PresupuestadaAhorros
            END AS CumplimientoAhorrosPct,

            CASE
                WHEN PresupuestadaPlazo = 0 THEN NULL
                ELSE EjecutadaPlazo * 100.0 / PresupuestadaPlazo
            END AS CumplimientoPlazoPct
        FROM Base
        ORDER BY EjecutadaCaptaciones DESC;
    `);

    return result;
}

export async function fetchCaptacionesHistoryFromSql(inputs = {}) {
    const pool = await getPool();
    if (!pool) return null;

    const sucursales = normalizeArrayFilter(inputs.sucursal, 'TODAS');
    const agencias = normalizeArrayFilter(inputs.agencia, 'TODAS');

    const request = pool.request();

    let sucursalFilter = '';
    if (Array.isArray(sucursales) && sucursales.length > 0) {
        const params = sucursales.map((_, i) => `@sucursal${i}`).join(', ');
        sucursalFilter = ` AND d.Sucursal IN (${params})`;

        sucursales.forEach((value, i) => {
            request.input(`sucursal${i}`, sql.NVarChar, value);
        });
    }

    let agenciaFilter = '';
    if (Array.isArray(agencias) && agencias.length > 0) {
        const params = agencias.map((_, i) => `@agencia${i}`).join(', ');
        agenciaFilter = ` AND c.Codigo IN (${params})`;

        agencias.forEach((value, i) => {
            request.input(`agencia${i}`, sql.Int, Number(value));
        });
    }

    const result = await request.query(`
        ;WITH Base AS (
            SELECT
                CAST(c.Fecha AS DATE) AS Fecha,

                SUM(ISNULL(c.Ejecutada_Captaciones, 0)) AS EjecutadaCaptaciones,
                SUM(ISNULL(c.Presupuestada_Captaciones, 0)) AS PresupuestadaCaptaciones,

                SUM(ISNULL(c.Ejecutada_Vista, 0)) AS EjecutadaVista,
                SUM(ISNULL(c.Presupuestada_Vista, 0)) AS PresupuestadaVista,

                SUM(ISNULL(c.Ejecutada_Ahorros, 0)) AS EjecutadaAhorros,
                SUM(ISNULL(c.Presupuestada_Ahorros, 0)) AS PresupuestadaAhorros,

                SUM(ISNULL(c.Ejecutada_Plazo, 0)) AS EjecutadaPlazo,
                SUM(ISNULL(c.Presupuestada_Plazo, 0)) AS PresupuestadaPlazo,

                SUM(ISNULL(c.Tendencia_Captaciones, 0)) AS TendenciaCaptaciones
            FROM Hub_Captaciones c
            LEFT JOIN DimAgencia d
                ON d.Cod_Agencia = c.Codigo
            WHERE 1 = 1
              ${sucursalFilter}
              ${agenciaFilter}
            GROUP BY
                CAST(c.Fecha AS DATE)
        )
        SELECT
            Fecha,

            EjecutadaCaptaciones,
            PresupuestadaCaptaciones,
            EjecutadaCaptaciones - PresupuestadaCaptaciones AS BrechaCaptaciones,

            EjecutadaVista,
            PresupuestadaVista,
            EjecutadaVista - PresupuestadaVista AS BrechaVista,

            EjecutadaAhorros,
            PresupuestadaAhorros,
            EjecutadaAhorros - PresupuestadaAhorros AS BrechaAhorros,

            EjecutadaPlazo,
            PresupuestadaPlazo,
            EjecutadaPlazo - PresupuestadaPlazo AS BrechaPlazo,

            TendenciaCaptaciones,

            CASE
                WHEN PresupuestadaCaptaciones = 0 THEN NULL
                ELSE EjecutadaCaptaciones * 100.0 / PresupuestadaCaptaciones
            END AS CumplimientoCaptacionesPct,

            CASE
                WHEN PresupuestadaVista = 0 THEN NULL
                ELSE EjecutadaVista * 100.0 / PresupuestadaVista
            END AS CumplimientoVistaPct,

            CASE
                WHEN PresupuestadaAhorros = 0 THEN NULL
                ELSE EjecutadaAhorros * 100.0 / PresupuestadaAhorros
            END AS CumplimientoAhorrosPct,

            CASE
                WHEN PresupuestadaPlazo = 0 THEN NULL
                ELSE EjecutadaPlazo * 100.0 / PresupuestadaPlazo
            END AS CumplimientoPlazoPct
        FROM Base
        ORDER BY Fecha ASC;
    `);

    return result;
}


/**
 * Catálogos para filtros cuando hay conexión SQL.
 * Fechas como texto yyyy-MM-dd; agencias: Cod_Agencia + columna Agencia (nombre).
 */
export async function fetchCatalogsFromSql() {
    const pool = await getPool();
    if (!pool) return null;

    try {
        const [
            fechasRes,
            fechasSFRes,
            sucRes,
            prodBnbRes,
            prodSfRes,
            bancosRes,
            agRes
        ] = await Promise.all([
            pool.request().query(`
                SELECT DISTINCT FORMAT(CAST(fecha AS DATE), 'yyyy-MM-dd') AS d
                FROM Hub_CarteraBNB
                ORDER BY d DESC
            `),
            pool.request().query(`
                SELECT DISTINCT FORMAT(CAST(fechadata AS DATE), 'yyyy-MM-dd') AS d
                FROM Hub_CarteraSF
                ORDER BY d DESC
            `),
            pool.request().query(`
                SELECT DISTINCT Sucursal AS s
                FROM DimAgencia
                WHERE Sucursal IS NOT NULL
                  AND LTRIM(RTRIM(Sucursal)) <> ''
                ORDER BY s
            `),
            pool.request().query(`
                SELECT DISTINCT segmentacioncredito AS p
                FROM Hub_CarteraBNB
                WHERE segmentacioncredito IS NOT NULL
                  AND LTRIM(RTRIM(segmentacioncredito)) <> ''
                ORDER BY p
            `),
            pool.request().query(`
                SELECT DISTINCT segmentacioncredito AS p
                FROM Hub_CarteraSF
                WHERE segmentacioncredito IS NOT NULL
                  AND LTRIM(RTRIM(segmentacioncredito)) <> ''
                ORDER BY p
            `),
            pool.request().query(`
                SELECT DISTINCT banco AS b
                FROM Hub_CarteraSF
                WHERE banco IS NOT NULL
                  AND LTRIM(RTRIM(banco)) <> ''
                ORDER BY b
            `),
            pool.request().query(`
                SELECT DISTINCT Cod_Agencia AS cod,
                                (
                                    CAST(Cod_Agencia AS NVARCHAR(50)) + N' · ' +
                                    LTRIM(RTRIM(ISNULL(Agencia, N'')))
                                    )       AS label,
                                Sucursal    AS sucursal
                FROM DimAgencia
                ORDER BY label
            `)
        ]);

        const formatDates = (res) => (res.recordset || []).map((row) => {
            const v = row.d;
            if (!v) return null;
            if (v instanceof Date) {
                return v.toISOString().slice(0, 10);
            }
            return String(v).slice(0, 10);
        }).filter(Boolean);

        const fechas = formatDates(fechasRes);
        const fechasSF = formatDates(fechasSFRes);
        const sucursales = ['TODAS', ...(sucRes.recordset || []).map((row) => row.s).filter(Boolean)];
        const productosBNB = ['TODOS', ...(prodBnbRes.recordset || []).map((row) => row.p).filter(Boolean)];
        const productosSF = ['TODOS', ...(prodSfRes.recordset || []).map((row) => row.p).filter(Boolean)];
        const bancos = ['TODOS', ...(bancosRes.recordset || []).map((row) => row.b).filter(Boolean)];
        const agRows = (agRes.recordset || []).map((row) => ({
            cod: row.cod,
            label: row.label,
            sucursal: row.sucursal
        }));
        const agencias = [{cod: 'TODAS', label: 'Todas las agencias', sucursal: null}, ...agRows];

        return {fechas, fechasSF, sucursales, productosBNB, productosSF, bancos, agencias};
    } catch (e) {
        console.error('fetchCatalogsFromSql:', e.message);
        return null;
    }
}

function projectionScenarioColumn(scenario = 'base') {
    const clean = String(scenario || 'base').toLowerCase();

    if (clean === 'optimista') return 'OPTIMISTA';
    if (clean === 'conservador' || clean === 'pesimista') return 'PESIMISTA';

    return 'NORMAL';
}

function projectionAmortizacionScenarioColumn(scenario = 'base') {
    const clean = String(scenario || 'base').toLowerCase();

    if (clean === 'optimista') return 'PESIMISTA';
    if (clean === 'conservador' || clean === 'pesimista') return 'OPTIMISTA';

    return 'NORMAL';
}

export const queries = {
    summary: `
        WITH FechaActual AS (SELECT COALESCE(CAST(@fecha AS DATE), MAX(fecha)) AS FechaReferencia
                             FROM Hub_CarteraBNB
                             WHERE (@fecha IS NULL OR fecha = @fecha)),
             FechaBase AS (SELECT MAX(fecha) AS FechaReferencia
                           FROM Hub_CarteraBNB
                           WHERE fecha <= '2025-12-31'),
             Actual AS (SELECT SUM(s.stock)                     AS StockActualUSD,
                               SUM(s.Desembolso)                AS DesembolsoMesUSD,
                               SUM(s.pendiente)                 AS PendienteUSD,
                               SUM(s.presupuesto)               AS PresupuestoStockUSD,
                               SUM(CASE
                                       WHEN s.segmentacioncredito = 'TARJETAS DE CREDITO' THEN 0
                                       ELSE s.amortizacion END) AS AmortizacionMesUSD
                        FROM Hub_CarteraBNB s
                                 INNER JOIN FechaActual fa ON s.fecha = fa.FechaReferencia
                                 INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
                        WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
                          AND (@producto IS NULL OR s.segmentacioncredito = @producto)
                          AND (@agencia IS NULL OR d.Cod_Agencia = @agencia)),
             AcumuladoAnio AS (SELECT SUM(s.Desembolso)                AS DesembolsoAcumuladoAnioUSD,
                                      SUM(CASE
                                              WHEN s.segmentacioncredito = 'TARJETAS DE CREDITO' THEN 0
                                              ELSE s.amortizacion END) AS AmortizacionAcumuladaAnioUSD
                               FROM Hub_CarteraBNB s
                                        INNER JOIN FechaActual fa
                                                   ON s.fecha >= DATEFROMPARTS(YEAR(fa.FechaReferencia), 1, 1)
                                                       AND s.fecha <= fa.FechaReferencia
                                        INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
                               WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
                                 AND (@producto IS NULL OR s.segmentacioncredito = @producto)
                                 AND (@agencia IS NULL OR d.Cod_Agencia = @agencia)),
             Base AS (SELECT SUM(s.stock) AS StockBaseUSD
                      FROM Hub_CarteraBNB s
                               INNER JOIN FechaBase fb ON s.fecha = fb.FechaReferencia
                               INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
                      WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
                        AND (@producto IS NULL OR s.segmentacioncredito = @producto)
                        AND (@agencia IS NULL OR d.Cod_Agencia = @agencia))
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
        SELECT s.fecha,
               SUM(s.stock)                     AS StockActualUSD,
               SUM(s.Desembolso)                AS DesembolsoUSD,
               SUM(s.presupuesto)               AS PresupuestoStockUSD,
               SUM(CASE
                       WHEN s.segmentacioncredito = 'TARJETAS DE CREDITO' THEN 0
                       ELSE s.amortizacion END) AS AmortizacionUSD,
               CASE
                   WHEN SUM(s.presupuesto) IS NULL OR SUM(s.presupuesto) = 0 THEN NULL
                   ELSE (SUM(s.stock) * 1.0 / SUM(s.presupuesto)) * 100
                   END                          AS CumplimientoStockPct
        FROM Hub_CarteraBNB s
                 INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
        WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
          AND (@producto IS NULL OR s.segmentacioncredito = @producto)
          AND (@agencia IS NULL OR d.Cod_Agencia = @agencia)
        GROUP BY s.fecha
        ORDER BY s.fecha ASC;
    `,

    kpisByProduct: `
        WITH FechaActual AS (SELECT COALESCE(CAST(@fecha AS DATE), MAX(fecha)) AS FechaReferencia
                             FROM Hub_CarteraBNB
                             WHERE (@fecha IS NULL OR fecha = @fecha)),
             FechaBase AS (SELECT MAX(fecha) AS FechaReferencia
                           FROM Hub_CarteraBNB
                           WHERE fecha <= '2025-12-31'),
             Actual AS (SELECT s.segmentacioncredito AS Producto,
                               SUM(s.stock)          AS StockActualUSD,
                               SUM(s.presupuesto)    AS PresupuestoStockUSD,
                               SUM(s.pendiente)      AS PendienteUSD
                        FROM Hub_CarteraBNB s
                                 INNER JOIN FechaActual fa ON s.fecha = fa.FechaReferencia
                                 INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
                        WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
                          AND (@producto IS NULL OR s.segmentacioncredito = @producto)
                          AND (@agencia IS NULL OR d.Cod_Agencia = @agencia)
                        GROUP BY s.segmentacioncredito),
             AcumuladoAnio AS (SELECT s.segmentacioncredito            AS Producto,
                                      SUM(s.Desembolso)                AS DesembolsoAcumuladoAnioUSD,
                                      SUM(CASE
                                              WHEN s.segmentacioncredito = 'TARJETAS DE CREDITO' THEN 0
                                              ELSE s.amortizacion END) AS AmortizacionAcumuladaAnioUSD
                               FROM Hub_CarteraBNB s
                                        INNER JOIN FechaActual fa
                                                   ON s.fecha >= DATEFROMPARTS(YEAR(fa.FechaReferencia), 1, 1)
                                                       AND s.fecha <= fa.FechaReferencia
                                        INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
                               WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
                                 AND (@producto IS NULL OR s.segmentacioncredito = @producto)
                                 AND (@agencia IS NULL OR d.Cod_Agencia = @agencia)
                               GROUP BY s.segmentacioncredito),
             Base AS (SELECT s.segmentacioncredito AS Producto,
                             SUM(s.stock)          AS StockBaseUSD
                      FROM Hub_CarteraBNB s
                               INNER JOIN FechaBase fb ON s.fecha = fb.FechaReferencia
                               INNER JOIN DimAgencia d ON d.Cod_Agencia = s.Idagencia
                      WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
                        AND (@producto IS NULL OR s.segmentacioncredito = @producto)
                        AND (@agencia IS NULL OR d.Cod_Agencia = @agencia)
                      GROUP BY s.segmentacioncredito)
        SELECT a.Producto,
               a.StockActualUSD,
               ISNULL(b.StockBaseUSD, 0)                    AS StockBaseUSD,
               aa.DesembolsoAcumuladoAnioUSD,
               aa.AmortizacionAcumuladaAnioUSD,
               a.PresupuestoStockUSD,
               a.PendienteUSD,
               a.StockActualUSD - ISNULL(b.StockBaseUSD, 0) AS CrecimientoNominalUSD,
               CASE
                   WHEN b.StockBaseUSD IS NULL OR b.StockBaseUSD = 0 THEN NULL
                   ELSE ((a.StockActualUSD * 1.0 / b.StockBaseUSD) - 1) * 100
                   END                                      AS CrecimientoPct,
               CASE
                   WHEN a.PresupuestoStockUSD IS NULL OR a.PresupuestoStockUSD = 0 THEN NULL
                   ELSE (a.StockActualUSD * 1.0 / a.PresupuestoStockUSD) * 100
                   END                                      AS CumplimientoStockPct
        FROM Actual a
                 LEFT JOIN Base b ON b.Producto = a.Producto
                 LEFT JOIN AcumuladoAnio aa ON aa.Producto = a.Producto
        ORDER BY a.StockActualUSD DESC;
    `,

    benchmark: `
        ;WITH FechaActual AS (
            SELECT
                COALESCE(
                    (
                        SELECT MAX(fechadata)
                        FROM Hub_CarteraSF
                        WHERE @fecha IS NOT NULL
                          AND fechadata <= CAST(@fecha AS DATE)
                    ),
                    (
                        SELECT MAX(fechadata)
                        FROM Hub_CarteraSF
                    )
                ) AS FechaReferencia
        ),
        BaseDic AS (
            SELECT MAX(fechadata) AS FechaReferencia
            FROM Hub_CarteraSF
            WHERE fechadata <= '2025-12-31'
        ),
        Actual AS (
            SELECT
                sf.banco,
                sf.segmentacioncredito,
                SUM(sf.monto) AS MontoActualUSD
            FROM Hub_CarteraSF sf
            INNER JOIN FechaActual fa
                ON sf.fechadata = fa.FechaReferencia
            WHERE (@banco IS NULL OR sf.banco = @banco)
              AND (@sucursal IS NULL OR sf.Sucursal = @sucursal)
              AND (@producto IS NULL OR sf.segmentacioncredito = @producto)
            GROUP BY
                sf.banco,
                sf.segmentacioncredito
        ),
        Base AS (
            SELECT
                sf.banco,
                sf.segmentacioncredito,
                SUM(sf.monto) AS MontoBaseUSD
            FROM Hub_CarteraSF sf
            INNER JOIN BaseDic bd
                ON sf.fechadata = bd.FechaReferencia
            WHERE (@banco IS NULL OR sf.banco = @banco)
              AND (@sucursal IS NULL OR sf.Sucursal = @sucursal)
              AND (@producto IS NULL OR sf.segmentacioncredito = @producto)
            GROUP BY
                sf.banco,
                sf.segmentacioncredito
        )
        SELECT
            (SELECT FechaReferencia FROM FechaActual) AS FechaCorteSF,
            a.banco,
            a.segmentacioncredito,
            a.MontoActualUSD,
            ISNULL(b.MontoBaseUSD, 0) AS MontoBaseUSD,
            a.MontoActualUSD - ISNULL(b.MontoBaseUSD, 0) AS CrecimientoTotalUSD,
            CASE
                WHEN b.MontoBaseUSD IS NULL OR b.MontoBaseUSD = 0 THEN NULL
                ELSE ((a.MontoActualUSD * 1.0 / b.MontoBaseUSD) - 1) * 100
            END AS CrecimientoPct
        FROM Actual a
        LEFT JOIN Base b
            ON b.banco = a.banco
           AND b.segmentacioncredito = a.segmentacioncredito
        ORDER BY CrecimientoTotalUSD DESC;
    `,

    marketShare: `
        ;WITH FechaActual AS (
            SELECT
                COALESCE(
                    (
                        SELECT MAX(fechadata)
                        FROM Hub_CarteraSF
                        WHERE @fecha IS NOT NULL
                          AND fechadata <= CAST(@fecha AS DATE)
                    ),
                    (
                        SELECT MAX(fechadata)
                        FROM Hub_CarteraSF
                    )
                ) AS FechaReferencia
        ),
        BaseDic AS (
            SELECT MAX(fechadata) AS FechaReferencia
            FROM Hub_CarteraSF
            WHERE fechadata <= '2025-12-31'
        ),
        Actual AS (
            SELECT
                sf.segmentacioncredito,
                SUM(CASE WHEN sf.banco = 'BNB' THEN sf.monto ELSE 0 END) AS MontoBNBUSD,
                SUM(sf.monto) AS MontoSistemaFinancieroUSD
            FROM Hub_CarteraSF sf
            INNER JOIN FechaActual fa
                ON sf.fechadata = fa.FechaReferencia
            WHERE (@sucursal IS NULL OR sf.Sucursal = @sucursal)
              AND (@producto IS NULL OR sf.segmentacioncredito = @producto)
            GROUP BY
                sf.segmentacioncredito
        ),
        Base AS (
            SELECT
                sf.segmentacioncredito,
                SUM(sf.monto) AS MontoSistemaBaseUSD
            FROM Hub_CarteraSF sf
            INNER JOIN BaseDic bd
                ON sf.fechadata = bd.FechaReferencia
            WHERE (@sucursal IS NULL OR sf.Sucursal = @sucursal)
              AND (@producto IS NULL OR sf.segmentacioncredito = @producto)
            GROUP BY
                sf.segmentacioncredito
        )
        SELECT
            (SELECT FechaReferencia FROM FechaActual) AS FechaCorteSF,
            a.segmentacioncredito,
            a.MontoBNBUSD,
            a.MontoSistemaFinancieroUSD,
            ISNULL(b.MontoSistemaBaseUSD, 0) AS MontoSistemaBaseUSD,
            a.MontoSistemaFinancieroUSD - ISNULL(b.MontoSistemaBaseUSD, 0) AS CrecimientoTotalUSD,
            CASE
                WHEN a.MontoSistemaFinancieroUSD IS NULL OR a.MontoSistemaFinancieroUSD = 0 THEN NULL
                ELSE (a.MontoBNBUSD * 1.0 / a.MontoSistemaFinancieroUSD) * 100
            END AS ParticipacionBNBPct,
            CASE
                WHEN b.MontoSistemaBaseUSD IS NULL OR b.MontoSistemaBaseUSD = 0 THEN NULL
                ELSE ((a.MontoSistemaFinancieroUSD * 1.0 / b.MontoSistemaBaseUSD) - 1) * 100
            END AS CrecimientoPct
        FROM Actual a
        LEFT JOIN Base b
            ON a.segmentacioncredito = b.segmentacioncredito
        ORDER BY CrecimientoTotalUSD DESC;
    `,

    oficiales: `
        WITH FechaActual AS (SELECT COALESCE(
                                            (SELECT MAX(FechaData)
                                             FROM Hub_OONN
                                             WHERE @fecha IS NOT NULL
                                               AND FechaData <= CAST(@fecha AS DATE)),
                                            (SELECT MAX(FechaData)
                                             FROM Hub_OONN)
                                    ) AS FechaReferencia),
             Detalle AS (SELECT d.Sucursal,
                                o.Oficial,
                                d.Cod_Agencia,
                                d.Agencia                     AS NombreAgencia,
                                SUM(o.MontoDesembolsoDolares) AS DesembolsoOficialUSD
                         FROM Hub_OONN o
                                  INNER JOIN DimAgencia d
                                             ON d.Cod_Agencia = o.ID_AGENCIA
                                  INNER JOIN FechaActual fa
                                             ON o.FechaData >= DATEFROMPARTS(YEAR(fa.FechaReferencia), 1, 1)
                                                 AND o.FechaData <= fa.FechaReferencia
                         WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
                           AND (@agencia IS NULL OR d.Cod_Agencia = @agencia)
                         GROUP BY d.Sucursal,
                                  o.Oficial,
                                  d.Cod_Agencia,
                                  d.Agencia),
             TotalAporte AS (SELECT SUM(o.MontoDesembolsoDolares) AS TotalAporteUSD
                             FROM Hub_OONN o
                                      INNER JOIN DimAgencia d
                                                 ON d.Cod_Agencia = o.ID_AGENCIA
                                      INNER JOIN FechaActual fa
                                                 ON o.FechaData >= DATEFROMPARTS(YEAR(fa.FechaReferencia), 1, 1)
                                                     AND o.FechaData <= fa.FechaReferencia
                             WHERE (@sucursal IS NULL OR d.Sucursal = @sucursal)
                               AND (@agencia IS NULL OR d.Cod_Agencia = @agencia))
        SELECT d.Sucursal,
               d.Oficial,
               d.Cod_Agencia,
               d.NombreAgencia,
               d.DesembolsoOficialUSD,
               t.TotalAporteUSD,
               CASE
                   WHEN t.TotalAporteUSD IS NULL OR t.TotalAporteUSD = 0 THEN NULL
                   ELSE (d.DesembolsoOficialUSD * 100.0 / t.TotalAporteUSD)
                   END AS ParticipacionAportePct
        FROM Detalle d
                 CROSS JOIN TotalAporte t
        ORDER BY d.DesembolsoOficialUSD DESC;
    `,

    status: `
        SELECT 'Hub_CarteraBNB' AS Fuente, MAX(fecha) AS FechaCorte
        FROM Hub_CarteraBNB
        UNION ALL
        SELECT 'Hub_CarteraSF' AS Fuente, MAX(fechadata) AS FechaCorte
        FROM Hub_CarteraSF
        UNION ALL
        SELECT 'Hub_OONN' AS Fuente, MAX(FechaData) AS FechaCorte
        FROM Hub_OONN
        UNION ALL
        SELECT 'Hub_CarteraSF_COMPARTIDA' AS Fuente, MAX(FECHA) AS FechaCorte
        FROM Hub_CarteraSF_COMPARTIDA
        UNION ALL
        SELECT 'Hub_Captaciones' AS Fuente, MAX(Fecha) AS FechaCorte
        FROM Hub_Captaciones
        UNION ALL
        SELECT 'Hub_Maduracion' AS Fuente, MAX(fechadata) AS FechaCorte
        FROM Hub_Maduracion
        UNION ALL
        SELECT 'Hub_LCF' AS Fuente, MAX(FechaData) AS FechaCorte
        FROM Hub_LCF;
    `
};