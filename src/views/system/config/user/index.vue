<script lang="ts" setup>
import { ref } from "vue";
import { useUserConfig } from "./utils/hook";
import CircleClose from "@iconify-icons/ep/circle-close";
import ReBaseTable from "@/components/ReBaseTable";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

defineOptions({
  name: "SystemUserConfig"
});

const tableRef = ref();

const { t, api, auth, columns, editForm, handleInvalidCache } =
  useUserConfig(tableRef);
</script>

<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :edit-form="editForm"
    :table-columns="columns"
    locale-name="configUser"
  >
    <template #extOperation="{ row, size }">
      <el-popconfirm
        v-if="auth.invalid"
        :title="t('configUser.confirmInvalid')"
        @confirm="handleInvalidCache(row)"
      >
        <template #reference>
          <el-button
            :icon="useRenderIcon(CircleClose)"
            :size="size"
            class="reset-margin"
            link
            type="primary"
          >
            {{ t("configUser.invalidCache") }}
          </el-button>
        </template>
      </el-popconfirm>
    </template>
  </ReBaseTable>
</template>
