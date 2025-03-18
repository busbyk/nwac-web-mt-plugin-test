import React from 'react'

import { TextFieldServerComponent } from 'payload'

import { SelectField } from '@payloadcms/ui'

export const CollectionsField: TextFieldServerComponent = async ({
  payload,
  path,
  field,
  clientField,
  readOnly,
}) => {
  const fieldPath = (path || field?.name || '') as string
  const { type: _type, admin, ...clientFields } = clientField

  return (
    <SelectField
      field={{
        type: 'select',
        admin: { ...admin, isClearable: false, isSortable: false },
        ...clientFields,
        options: Object.keys(payload.collections).map((slug) => ({ label: slug, value: slug })),
      }}
      path={fieldPath}
      readOnly={readOnly === undefined ? true : readOnly}
    />
  )
}
