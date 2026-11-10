'use strict';

const DEFAULT_TYPE = 'trial';

const DEFAULT_DEMO_PRODUCTS = Object.freeze(['住院医师规范化培训系统']);
const DEFAULT_DEMO_NOTICE = '预约产品演示, 本系统不提供试用, 可备注业务场景, 我们针对性演示.';

// Each reservation type selects its own title, product label, product list,
// pre-filled note, and notification heading. The URL query string picks the
// type; storage keeps the key so admin filters and exports can distinguish them.
const RESERVATION_TYPES = Object.freeze({
  trial: Object.freeze({
    key: 'trial',
    title: '产品试用预约',
    shortLabel: '试用',
    productLabel: '试用产品',
    productsSetting: 'products',
    privacyVerb: '试用',
    notificationTitle: '新的试用预约',
  }),
  demo: Object.freeze({
    key: 'demo',
    title: '产品演示预约',
    shortLabel: '演示',
    productLabel: '演示产品',
    productsSetting: 'demo_products',
    privacyVerb: '演示',
    notificationTitle: '新的演示预约',
  }),
});

function getReservationType(key) {
  return RESERVATION_TYPES[key] || RESERVATION_TYPES[DEFAULT_TYPE];
}

// Missing/blank values mean "use the default type" so pages cached from the
// previous release keep submitting. Any other unrecognized value is rejected.
function parseReservationType(value) {
  if (value === undefined || value === null) return DEFAULT_TYPE;
  if (typeof value !== 'string') return null;
  const key = value.trim();
  if (!key) return DEFAULT_TYPE;
  return Object.prototype.hasOwnProperty.call(RESERVATION_TYPES, key) ? key : null;
}

module.exports = {
  DEFAULT_DEMO_NOTICE,
  DEFAULT_DEMO_PRODUCTS,
  DEFAULT_TYPE,
  RESERVATION_TYPES,
  getReservationType,
  parseReservationType,
};
