export const CONFIG = {
  defaultEnv: "prod",
  environments: {
    prod: {
      peer: {
        storesDirectory: "stores/",
        storeName: "__PEER_STORE_NAME__",
        subnetChannel: "__PROD_SUBNET_CHANNEL__",
        subnetBootstrap: null
      },
      msb: {
        storesDirectory: "stores/",
        storeName: "__PROD_MSB_STORE_NAME__",
        bootstrap: "__PROD_MSB_BOOTSTRAP__",
        channel: "__PROD_MSB_CHANNEL__"
      }
    },
    dev: {
      peer: {
        storesDirectory: "stores/",
        storeName: "__DEV_PEER_STORE_NAME__",
        subnetChannel: "__DEV_SUBNET_CHANNEL__",
        subnetBootstrap: null
      },
      msb: {
        storesDirectory: "stores/",
        storeName: "__DEV_MSB_STORE_NAME__",
        bootstrap: "__DEV_MSB_BOOTSTRAP__",
        channel: "__DEV_MSB_CHANNEL__"
      }
    }
  }
};
