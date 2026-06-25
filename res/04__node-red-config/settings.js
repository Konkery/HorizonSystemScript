module.exports = {
    uiHost: "0.0.0.0",
    adminAuth: {
        type: 'credentials',
        users: [
            { username: 'operator1', password: "$2y$08$KHxFeeGEfMTszhhyUjdvEe89uN7zsaWJCaJnedO1DvM1GRcd9.PLK", permissions: '*' },
            { username: 'operator2', password: "$2y$08$tA.8sW/wu8BKPWcZgIG8remMN6CJm46gfUTlONUvcfajUFuZBR4eS", permissions: '*' },
            { username: 'operator3', password: "$2y$08$aIrKhLTXYM9rPuwY0J431OkfjXS89i2X2i6jcCawtqg/s7uKuCy.y", permissions: '*' },
            { username: 'operator4', password: "$2y$08$EvFgMsR3lTACQV6wFdh0NOmPdYz57Gv7BiJUHtq1tbOPuQKtQOIa.", permissions: '*' },
            { username: 'operator5', password: "$2y$08$P25.T5DVQS6R1UKyC.80leFH/u0FTDYSaToszjSjKHAuKWKJF9BKe", permissions: '*' },
            { username: 'system', password: "$2y$08$Gl5cRi2nfnh/LpZ3BR4RaOlMPw3FiMLdRa.FdGG0pMYJPi3pc/D82", permissions: '*' }
        ]
    },
    uiPort: 2003,
    ui: { path: 'ui' },
    functionExternalModules: true,
    functionGlobalContext: require('./dependencies.js'),
    logging: { console: { level: 'info', metrics: false, audit: false } },
    editorTheme: {
        projects: { enabled: false },
        codeEditor: { lib: 'monaco' }
    }
}