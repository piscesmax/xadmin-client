import "./reset.css";
import dayjs from "dayjs";
import { message } from "@/utils/message";
import { zxcvbn } from "@zxcvbn-ts/core";
import {
  createUserApi,
  deleteUserApi,
  getUserListApi,
  manyDeleteUserApi,
  updateUserApi,
  updateUserPasswordApi,
  uploadUserAvatarApi
} from "@/api/system/user";
import {
  ElForm,
  ElInput,
  ElFormItem,
  ElProgress,
  ElMessageBox
} from "element-plus";
import { type PaginationProps, TableColumns } from "@pureadmin/table";
import { utils, writeFile } from "xlsx";
import {
  type Ref,
  reactive,
  ref,
  computed,
  onMounted,
  toRaw,
  h,
  watch
} from "vue";
import { addDialog } from "@/components/ReDialog/index";
import croppingUpload from "../upload.vue";
import roleForm from "../form/role.vue";
import editForm from "../form/index.vue";
import { FormItemProps, RoleFormItemProps } from "./types";
import { empowerRoleApi, getRoleListApi } from "@/api/system/role";
import {
  cloneDeep,
  getKeyList,
  hideTextAtIndex,
  isAllEmpty,
  isEmpty,
  isString
} from "@pureadmin/utils";
import { useRoute } from "vue-router";
import avatar from "./avatar.png";
import { hasAuth } from "@/router/utils";
const sortOptions = [
  { label: "注册时间 Descending", key: "-date_joined" },
  { label: "注册时间 Ascending", key: "date_joined" },
  { label: "登录时间 Descending", key: "-last_login" },
  { label: "登录时间 Ascending", key: "last_login" }
];
export function useUser(tableRef: Ref) {
  const form = reactive({
    pk: "",
    username: "",
    mobile: "",
    is_active: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const route = useRoute();
  const getParameter = isEmpty(route.params) ? route.query : route.params;
  const dataList = ref([]);
  const roleData = ref([]);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const currentAvatarData = reactive({
    file: "",
    img: "",
    status: false
  });
  const manySelectCount = ref(0);
  const avatarInfo = ref();
  const ruleFormRef = ref();
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  });
  const columns: TableColumnList = [
    {
      type: "selection",
      align: "left"
    },
    {
      label: "用户ID",
      prop: "pk",
      minWidth: 130
    },
    {
      label: "用户头像",
      prop: "avatar",
      minWidth: 160,
      cellRenderer: ({ row }) => (
        <el-image
          class="w-[60px] h-[60px]"
          fit={"contain"}
          src={row.avatar}
          loading={"lazy"}
          preview-teleported={true}
          preview-src-list={Array.of(row.avatar)}
        />
      )
    },
    {
      label: "用户名称",
      prop: "username",
      minWidth: 130
    },
    {
      label: "用户昵称",
      prop: "nickname",
      minWidth: 130
    },
    {
      label: "性别",
      prop: "sex",
      minWidth: 90,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.sex === 1 ? "danger" : ""}
          effect="plain"
        >
          {row.sex === 1 ? "女" : "男"}
        </el-tag>
      )
    },
    // {
    //   label: "部门",
    //   prop: "dept",
    //   minWidth: 90,
    //   formatter: ({ dept }) => dept
    // },
    {
      label: "手机号码",
      prop: "mobile",
      minWidth: 90,
      formatter: ({ mobile }) => hideTextAtIndex(mobile, { start: 3, end: 6 })
    },
    {
      label: "状态",
      prop: "is_active",
      minWidth: 90,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.is_active}
          active-value={true}
          inactive-value={false}
          active-text="已开启"
          inactive-text="已关闭"
          disabled={!hasAuth("update:systemUser")}
          inline-prompt
          onChange={() => onChange(scope as any)}
        />
      )
    },
    {
      label: "角色",
      prop: "roles",
      width: 160,
      slot: "roles"
    },
    {
      label: "注册时间",
      minWidth: 90,
      prop: "date_joined",
      formatter: ({ date_joined }) =>
        dayjs(date_joined).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: "操作",
      fixed: "right",
      width: 180,
      slot: "operation"
    }
  ];
  const buttonClass = computed(() => {
    return [
      "!h-[20px]",
      "reset-margin",
      "!text-gray-500",
      "dark:!text-white",
      "dark:hover:!text-primary"
    ];
  });
  // 重置的新密码
  const pwdForm = reactive({
    newPwd: ""
  });
  const pwdProgress = [
    { color: "#e74242", text: "非常弱" },
    { color: "#EFBD47", text: "弱" },
    { color: "#ffa500", text: "一般" },
    { color: "#1bbf1b", text: "强" },
    { color: "#008000", text: "非常强" }
  ];
  // 当前密码强度（0-4）
  const curScore = ref();
  const roleOptions = ref([]);

  function onChange({ row, index }) {
    ElMessageBox.confirm(
      `确认要<strong>${
        row.is_active === false ? "停用" : "启用"
      }</strong><strong style='color:var(--el-color-primary)'>${
        row.username
      }</strong>用户吗?`,
      "系统提示",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
        dangerouslyUseHTMLString: true,
        draggable: true
      }
    )
      .then(() => {
        switchLoadMap.value[index] = Object.assign(
          {},
          switchLoadMap.value[index],
          {
            loading: true
          }
        );
        updateUserApi(row.pk, row).then(res => {
          if (res.code === 1000) {
            switchLoadMap.value[index] = Object.assign(
              {},
              switchLoadMap.value[index],
              {
                loading: false
              }
            );
            message("已成功修改用户状态", {
              type: "success"
            });
          }
        });
      })
      .catch(() => {
        row.is_active === false
          ? (row.is_active = true)
          : (row.is_active = false);
      });
  }

  async function handleDelete(row) {
    deleteUserApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message("操作成功", { type: "success" });
        await onSearch();
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
      }
    });
  }

  async function handleSizeChange(val: number) {
    form.page = 1;
    form.size = val;
    await onSearch();
  }

  async function handleCurrentChange(val: number) {
    form.page = val;
    await onSearch();
  }

  function handleSelectionChange(val) {
    manySelectCount.value = val.length;
  }
  function onSelectionCancel() {
    manySelectCount.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }
  function handleManyDelete() {
    if (manySelectCount.value === 0) {
      message("数据未选择", { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteUserApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(async res => {
      if (res.code === 1000) {
        message(`批量删除了${manySelectCount.value}条数据`, {
          type: "success"
        });
        await onSearch();
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
      }
      tableRef.value.getTableRef().clearSelection();
    });
  }

  async function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = 10;
    }
    loading.value = true;
    const { data } = await getUserListApi(toRaw(form));
    dataList.value = data.results;
    pagination.total = data.total;
    setTimeout(() => {
      loading.value = false;
    }, 500);
  }

  const uploadAvatar = (
    uid: number,
    file: any,
    callBack: Function,
    errorBack: Function = null
  ) => {
    const data = new FormData();
    data.append("file", file);
    data.append("uid", uid.toString());
    uploadUserAvatarApi({ uid: uid }, data).then(res => {
      if (res.code === 1000) {
        callBack(res);
      } else {
        if (errorBack) {
          errorBack(res);
        }
      }
    });
  };

  function openDialog(title = "新增", row?: FormItemProps) {
    addDialog({
      title: `${title}用户`,
      props: {
        formInline: {
          title,
          pk: row?.pk ?? "",
          username: row?.username ?? "",
          nickname: row?.nickname ?? "",
          avatar: row?.avatar ?? "",
          mobile: row?.mobile ?? "",
          email: row?.email ?? "",
          sex: row?.sex ?? 0,
          roles: row?.roles ?? [],
          password: row?.password ?? "",
          is_active: row?.is_active ?? true,
          remark: row?.remark ?? ""
        }
      },
      width: "46%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        async function chores(detail) {
          message(detail, {
            type: "success"
          });
          done(); // 关闭弹框
          await onSearch(); // 刷新表格数据
        }
        FormRef.validate(valid => {
          if (valid) {
            console.log("curData", curData);
            // 表单规则校验通过
            if (title === "新增") {
              createUserApi(curData).then(async res => {
                if (res.code === 1000) {
                  // if (avatarFile.file) {
                  //   uploadAvatar(res.data.pk, avatarFile.file, async () => {
                  //     await chores(res.detail);
                  //   });
                  // } else {
                  await chores(res.detail);
                  // }
                } else {
                  message(`操作失败，${res.detail}`, { type: "error" });
                }
              });
            } else {
              updateUserApi(curData.pk, curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
                } else {
                  message(`操作失败，${res.detail}`, { type: "error" });
                }
              });
            }
          }
        });
      }
    });
  }

  const resetForm = async formEl => {
    if (!formEl) return;
    formEl.resetFields();
    await onSearch();
  };

  const exportExcel = () => {
    if (manySelectCount.value === 0) {
      message("数据未选择", { type: "error" });
      return;
    }
    loading.value = true;
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    const res: string[][] = manySelectData.map((item: FormItemProps) => {
      const arr = [];
      columns.forEach((column: TableColumns | any) => {
        if (column.label) {
          arr.push(item[column.prop]);
        }
      });
      return arr;
    });

    const titleList: string[] = [];
    columns.forEach((column: TableColumns) => {
      if (column.label) {
        titleList.push(column.label);
      }
    });
    res.unshift(titleList);
    const workSheet = utils.aoa_to_sheet(res);
    const workBook = utils.book_new();
    utils.book_append_sheet(workBook, workSheet, "注册用户报表");
    writeFile(workBook, "用户数据.xlsx");
    loading.value = false;
  };

  /** 上传头像 */
  function handleUpload(row) {
    addDialog({
      title: `更新用户 ${row.username} 的头像`,
      width: "40%",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () =>
        h(croppingUpload, {
          imgSrc: row.avatar ?? avatar,
          onCropper: info => (avatarInfo.value = info)
        }),
      beforeSure: done => {
        console.log("裁剪后的图片信息：", avatarInfo.value);
        const avatarFile = new File([avatarInfo.value.blob], "avatar.png", {
          type: avatarInfo.value.blob.type,
          lastModified: Date.now()
        });
        uploadAvatar(
          row.pk,
          avatarFile,
          () => {
            message("头像更新成功", { type: "success" });
            onSearch();
            done();
          },
          res => {
            message("头像上传失败" + res.detail, { type: "error" });
            done();
          }
        );
      }
    });
  }

  onMounted(async () => {
    if (getParameter) {
      const parameter = cloneDeep(getParameter);
      Object.keys(parameter).forEach(param => {
        if (!isString(parameter[param])) {
          parameter[param] = parameter[param].toString();
        }
      });
      form.pk = parameter.pk;
    }
    await onSearch();
    // 角色列表
    roleOptions.value = (
      await getRoleListApi({ page: 1, size: 1000 })
    ).data.results;
  });

  watch(
    pwdForm,
    ({ newPwd }) =>
      (curScore.value = isAllEmpty(newPwd) ? -1 : zxcvbn(newPwd).score)
  );

  /** 分配角色 */
  async function handleRole(row) {
    addDialog({
      title: `分配 ${row.username} 用户的角色`,
      props: {
        formInline: {
          username: row?.username ?? "",
          nickname: row?.nickname ?? "",
          roleOptions: roleOptions.value ?? [],
          ids: row?.roles ?? []
        }
      },
      width: "400px",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(roleForm),
      beforeSure: (done, { options }) => {
        const curData = options.props.formInline as RoleFormItemProps;
        empowerRoleApi({
          uid: row.pk,
          roles: curData.ids
        }).then(async res => {
          if (res.code === 1000) {
            message(`用户 ${row.username} 角色分配成功`, {
              type: "success"
            });
            onSearch();
          } else {
            message(`操作失败，${res.detail}`, { type: "error" });
          }
          done(); // 关闭弹框
        });
      }
    });
  }

  /** 重置密码 */
  function handleReset(row) {
    addDialog({
      title: `重置 ${row.username} 用户的密码`,
      width: "30%",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () => (
        <>
          <ElForm ref={ruleFormRef} model={pwdForm}>
            <ElFormItem
              prop="newPwd"
              rules={[
                {
                  required: true,
                  message: "请输入新密码",
                  trigger: "blur"
                }
              ]}
            >
              <ElInput
                clearable
                show-password
                type="password"
                v-model={pwdForm.newPwd}
                placeholder="请输入新密码"
              />
            </ElFormItem>
          </ElForm>
          <div class="mt-4 flex">
            {pwdProgress.map(({ color, text }, idx) => (
              <div
                class="w-[19vw]"
                style={{ marginLeft: idx !== 0 ? "4px" : 0 }}
              >
                <ElProgress
                  striped
                  striped-flow
                  duration={curScore.value === idx ? 6 : 0}
                  percentage={curScore.value >= idx ? 100 : 0}
                  color={color}
                  stroke-width={10}
                  show-text={false}
                />
                <p
                  class="text-center"
                  style={{ color: curScore.value === idx ? color : "" }}
                >
                  {text}
                </p>
              </div>
            ))}
          </div>
        </>
      ),
      closeCallBack: () => (pwdForm.newPwd = ""),
      beforeSure: done => {
        ruleFormRef.value.validate(valid => {
          if (valid) {
            updateUserPasswordApi({
              uid: row.pk,
              password: pwdForm.newPwd
            }).then(async res => {
              if (res.code === 1000) {
                message(`已成功重置 ${row.username} 用户的密码`, {
                  type: "success"
                });
              } else {
                message(`操作失败，${res.detail}`, { type: "error" });
              }
              done(); // 关闭弹框
            });
          }
        });
      }
    });
  }

  return {
    form,
    loading,
    columns,
    dataList,
    pagination,
    buttonClass,
    sortOptions,
    roleData,
    manySelectCount,
    currentAvatarData,
    exportExcel,
    onSearch,
    openDialog,
    onSelectionCancel,
    resetForm,
    handleRole,
    handleDelete,
    handleUpload,
    handleReset,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}