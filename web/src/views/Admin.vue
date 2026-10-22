<template>
  <div class="admin-page">
    <div class="admin-sidebar">
      <div class="admin-logo">
        <span class="logo-seal">鱼</span>
        <div class="logo-text">
          <b>{{ $t('admin.title') }}</b>
          <span>XIAOXIANYU ADMIN</span>
        </div>
      </div>

      <el-menu :default-active="activeSection" class="admin-menu">
        <el-menu-item index="dashboard" @click="activeSection = 'dashboard'">
          <el-icon><DataBoard /></el-icon><span>{{ $t('admin.dashboard') }}</span>
        </el-menu-item>
        <el-menu-item index="posts" @click="switchSection('posts')">
          <el-icon><ChatDotRound /></el-icon><span>{{ $t('admin.posts') }}</span>
        </el-menu-item>
        <el-menu-item index="notifications" @click="activeSection = 'notifications'">
          <el-icon><Bell /></el-icon><span>{{ $t('admin.notifications') }}</span>
        </el-menu-item>
        <el-menu-item index="items" @click="switchSection('items')">
          <el-icon><Box /></el-icon><span>{{ $t('admin.items') }}</span>
        </el-menu-item>
        <el-menu-item index="plaza" @click="switchSection('plaza')">
          <el-icon><ChatLineSquare /></el-icon><span>{{ $t('admin.plazaManage') }}</span>
        </el-menu-item>
        <el-menu-item index="afterSales" @click="switchSection('afterSales')">
          <el-icon><Service /></el-icon><span>{{ $t('admin.afterSales') }}</span>
          <el-tag v-if="stats?.aftersalePending" size="small" type="danger" class="menu-badge">{{ stats.aftersalePending }}</el-tag>
        </el-menu-item>
        <el-menu-item index="users" @click="switchSection('users')">
          <el-icon><User /></el-icon><span>{{ $t('admin.users') }}</span>
        </el-menu-item>
      </el-menu>

      <div class="admin-sidebar-footer">
        <el-button text class="back-btn" @click="$router.push('/')">
          <el-icon><Back /></el-icon>{{ $t('admin.back') }}</el-button>
      </div>
    </div>

    <div class="admin-main">
      <div class="admin-header">
        <h2 class="admin-title">{{ sectionTitle }}</h2>
        <div class="admin-user-info">
          <span class="admin-role-tag">{{ $t('common.admin') }}</span>
          <span>{{ userStore.userInfo?.nickname }}</span>
        </div>
      </div>

      <div class="admin-content">
        <!-- ===== 数据概览 ===== -->
        <template v-if="activeSection === 'dashboard'">
          <div class="stat-grid">
            <div class="stat-card" v-for="s in statCards" :key="s.label">
              <div class="stat-icon" :style="{ background: s.color }">
                <el-icon :size="22"><component :is="s.icon" /></el-icon>
              </div>
              <div class="stat-body">
                <b class="stat-num">{{ s.value }}</b>
                <span class="stat-label">{{ s.label }}</span>
              </div>
            </div>
          </div>

          <!-- 当日最新 + 近7天上架趋势（仅管理台可见） -->
          <div class="panel" v-if="homeStats">
            <h3 class="panel-title">{{ $t('admin.todayLatest') }}</h3>
            <div class="admin-today-stats">
              <div class="admin-today-card admin-today-boards">
                <div class="admin-today-icon">📚</div>
                <div class="admin-today-info">
                  <div class="admin-today-num">{{ homeStats.todayBoards }}</div>
                  <div class="admin-today-label">{{ $t('admin.todayBoards') }}</div>
                </div>
              </div>
              <div class="admin-today-card admin-today-books">
                <div class="admin-today-icon">📖</div>
                <div class="admin-today-info">
                  <div class="admin-today-num">{{ homeStats.todayBooks }}</div>
                  <div class="admin-today-label">{{ $t('admin.todayBooks') }}</div>
                </div>
              </div>
            </div>
          </div>

          <StatsCharts v-if="chartData" :data="chartData" />

          <div class="panel">
            <h3 class="panel-title">{{ $t('admin.latestUsers') }}</h3>
            <el-table :data="stats?.recentUsers || []" size="small">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column prop="email" :label="$t('profile.email')" />
              <el-table-column prop="nickname" :label="$t('admin.nickname')" width="120" />
              <el-table-column prop="campus" :label="$t('admin.campus')" width="100" />
              <el-table-column :label="$t('admin.role')" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.role === 'admin' ? 'danger' : 'info'">{{ row.role === 'admin' ? t('common.admin') : t('common.user') }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.status')" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'banned' ? 'danger' : 'success'">{{ row.status === 'banned' ? t('common.banned') : t('common.normal') }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <!-- ===== 帖子管理 ===== -->
        <template v-if="activeSection === 'posts'">
          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.hotPosts') }}</h3>
              <el-button size="small" @click="loadPosts">{{ $t('common.refresh') }}</el-button>
            </div>
            <el-table :data="posts" size="small">
              <el-table-column prop="sort_order" :label="$t('admin.sortOrder')" width="70" />
              <el-table-column prop="tag" :label="$t('home.category')" width="90">
                <template #default="{ row }"><el-tag size="small">{{ row.tag }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="title" :label="$t('home.title')" min-width="160" />
              <el-table-column prop="author" :label="$t('publish.author')" width="100" />
              <el-table-column prop="description" :label="$t('home.content')" min-width="200" show-overflow-tooltip />
              <el-table-column :label="$t('admin.status')" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? t('common.active') : t('common.deleted') }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('common.actions')" width="190" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="primary" :disabled="row.status !== 'active'" @click="movePost(row, 'up')">{{ $t('admin.moveUp') }}</el-button>
                  <el-button size="small" text type="primary" :disabled="row.status !== 'active'" @click="movePost(row, 'down')">{{ $t('admin.moveDown') }}</el-button>
                  <el-button size="small" text type="danger" :disabled="row.status !== 'active'" @click="removePost(row)">{{ $t('common.delete') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <!-- ===== 通知管理 ===== -->
        <template v-if="activeSection === 'notifications'">
          <div class="panel">
            <h3 class="panel-title">{{ $t('admin.broadcastTitle') }}</h3>
            <el-input v-model="broadcastContent" type="textarea" :rows="3" :placeholder="$t('admin.broadcastPlaceholder')" />
            <div class="panel-actions">
              <el-button type="primary" @click="broadcast">{{ $t('admin.broadcast') }}</el-button>
            </div>
          </div>

          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.singleTitle') }}</h3>
              <el-button size="small" @click="loadUsersForSelect">{{ $t('admin.refreshUsers') }}</el-button>
            </div>
            <div class="single-send-row">
              <el-select v-model="singleUserId" filterable :placeholder="$t('admin.selectUser')" style="width: 300px">
                <el-option
                  v-for="u in userOptions"
                  :key="u.id"
                  :label="`${u.nickname}（${u.email}）`"
                  :value="u.id"
                />
              </el-select>
              <el-input v-model="singleContent" :placeholder="$t('admin.notifContent')" style="width: 320px" />
            </div>
            <div class="panel-actions">
              <el-button type="primary" @click="sendSingle">{{ $t('common.send') }}</el-button>
            </div>
          </div>

          <div class="panel">
            <h3 class="panel-title">{{ $t('admin.logTip') }}</h3>
            <p class="muted-text">{{ $t('admin.logTipDesc') }}</p>
          </div>

          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.sentNotifs') }}</h3>
              <el-button size="small" @click="loadNotifList">{{ $t('common.refresh') }}</el-button>
            </div>
            <el-table :data="notifList" size="small">
              <el-table-column :label="$t('admin.type')" width="90">
                <template #default="{ row }">
                  <el-tag :type="row.type === 'broadcast' ? 'warning' : 'info'" size="small">
                    {{ row.type === 'broadcast' ? t('admin.broadcastType') : t('admin.singleType') }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="content" :label="$t('home.content')" min-width="250" show-overflow-tooltip />
              <el-table-column prop="time" :label="$t('admin.time')" width="160" />
              <el-table-column :label="$t('common.actions')" width="90" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="danger" @click="deleteNotif(row)">{{ $t('common.delete') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <!-- ===== 物品管理 ===== -->
        <template v-if="activeSection === 'items'">
          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.itemManage') }}</h3>
              <div class="toolbar-right">
                <el-input
                  v-model="itemKeyword"
                  :placeholder="$t('admin.itemSearchPlaceholder')"
                  clearable
                  style="width: 220px"
                  @keyup.enter="loadItems"
                  @clear="loadItems"
                />
                <el-select v-model="itemCategory" clearable :placeholder="$t('admin.allCategories')" style="width: 140px" @change="loadItems">
                  <el-option v-for="c in categories" :key="c.value" :label="$t('tradeCat.' + c.key)" :value="c.value" />
                </el-select>
                <el-button size="small" @click="loadItems">{{ $t('common.refresh') }}</el-button>
              </div>
            </div>
            <el-table :data="itemList" size="small">
              <el-table-column prop="id" label="ID" width="60" />
              <el-table-column :label="$t('admin.cover')" width="70">
                <template #default="{ row }">
                  <img v-if="itemCover(row)" :src="itemCover(row)" style="width:36px;height:46px;object-fit:cover;border-radius:4px" @error="imgFallback" />
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.itemTitle')" min-width="180">
                <template #default="{ row }">{{ row.bookTitle || row.title }}</template>
              </el-table-column>
              <el-table-column :label="$t('admin.itemCategory')" width="168">
                <template #default="{ row }">
                  <el-select :model-value="row.category" size="small" class="item-cat" @change="(v) => changeItemCategory(row, v)">
                    <el-option v-for="c in categories" :key="c.value" :label="$t('tradeCat.' + c.key)" :value="c.value" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.itemPrice')" width="90">
                <template #default="{ row }">¥{{ row.price }}</template>
              </el-table-column>
              <el-table-column :label="$t('admin.itemSeller')" width="150">
                <template #default="{ row }">{{ row.seller?.nickname || '—' }}</template>
              </el-table-column>
              <el-table-column :label="$t('admin.status')" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'available' ? 'success' : 'info'">
                    {{ row.status === 'available' ? t('common.available') : t('common.sold') }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('common.actions')" width="90" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="danger" @click="removeItem(row)">{{ $t('common.delete') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="pager" v-if="itemTotal > itemPageSize">
              <el-pagination
                layout="prev, pager, next"
                :total="itemTotal"
                :page-size="itemPageSize"
                v-model:current-page="itemPage"
                @current-change="loadItems"
              />
            </div>
          </div>
        </template>

        <!-- ===== 广场管理 ===== -->
        <template v-if="activeSection === 'plaza'">
          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.plazaManage') }}</h3>
              <div class="toolbar-right">
                <el-input
                  v-model="plazaKeyword"
                  :placeholder="$t('admin.plazaContent')"
                  clearable
                  style="width: 220px"
                  @keyup.enter="loadPlaza"
                  @clear="loadPlaza"
                />
                <el-button size="small" @click="loadPlaza">{{ $t('common.refresh') }}</el-button>
              </div>
            </div>
            <el-table :data="plazaList" size="small">
              <el-table-column :label="$t('admin.plazaAuthor')" width="170">
                <template #default="{ row }">
                  {{ row.author?.nickname || '—' }}<span class="muted-text" v-if="row.author?.userNo">（{{ row.author.userNo }}）</span>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.plazaContent')" min-width="240">
                <template #default="{ row }">
                  <span class="plaza-content">{{ row.content || '—' }}</span>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.plazaImages')" width="150">
                <template #default="{ row }">
                  <div class="plaza-thumbs" v-if="row.images && row.images.length">
                    <img v-for="(img, i) in row.images.slice(0, 3)" :key="i" :src="resolveImg(img)" @error="imgFallback" />
                    <span v-if="row.images.length > 3" class="more">+{{ row.images.length - 3 }}</span>
                  </div>
                  <span v-else class="muted-text">—</span>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.plazaTime')" width="150">
                <template #default="{ row }">{{ formatDate(row.created_at || row.createdAt) }}</template>
              </el-table-column>
              <el-table-column :label="$t('admin.plazaStatus')" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">
                    {{ row.status === 'active' ? t('admin.plazaActive') : t('admin.plazaHidden') }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('common.actions')" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="primary" @click="togglePlaza(row)">
                    {{ row.status === 'active' ? t('admin.plazaHide') : t('admin.plazaShow') }}
                  </el-button>
                  <el-button size="small" text type="danger" @click="removePlaza(row)">{{ $t('common.delete') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-if="!plazaList.length" :description="$t('plaza.empty')" :image-size="80" />
          </div>
        </template>

        <!-- ===== 售后管理 ===== -->
        <template v-if="activeSection === 'afterSales'">
          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.afterSales') }}</h3>
              <div class="toolbar-right">
                <el-select v-model="aftersaleStatus" clearable :placeholder="$t('admin.afterSaleAll')" style="width: 140px" @change="loadAfterSales">
                  <el-option :label="$t('admin.afterSalePending')" value="pending" />
                  <el-option :label="$t('admin.afterSaleProcessing')" value="processing" />
                  <el-option :label="$t('admin.afterSaleResolved')" value="resolved" />
                  <el-option :label="$t('admin.afterSaleRejected')" value="rejected" />
                </el-select>
                <el-button size="small" @click="loadAfterSales">{{ $t('common.refresh') }}</el-button>
              </div>
            </div>
            <el-table :data="afterSales" size="small">
              <el-table-column prop="id" label="ID" width="60" />
              <el-table-column :label="$t('admin.afterSaleOrder')" width="100">
                <template #default="{ row }">#{{ row.orderId }}</template>
              </el-table-column>
              <el-table-column :label="$t('admin.afterSaleBuyer')" width="160">
                <template #default="{ row }">
                  {{ row.buyer?.nickname || '—' }}
                  <span class="muted-text" v-if="row.buyer?.userNo">（{{ row.buyer.userNo }}）</span>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.afterSaleItems')" min-width="190">
                <template #default="{ row }">
                  <span class="plaza-content">{{ afterSaleItems(row) }}</span>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.afterSaleReason')" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.reason || '—' }}</template>
              </el-table-column>
              <el-table-column :label="$t('admin.afterSaleStatus')" width="100">
                <template #default="{ row }">
                  <el-tag size="small" :type="aftersaleTagType(row.status)">{{ aftersaleStatusLabel(row.status) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.afterSaleTime')" width="150">
                <template #default="{ row }">{{ formatDate(row.created_at || row.createdAt) }}</template>
              </el-table-column>
              <el-table-column :label="$t('admin.afterSaleHandler')" width="120">
                <template #default="{ row }">{{ row.admin?.nickname || '—' }}</template>
              </el-table-column>
              <el-table-column :label="$t('common.actions')" width="90" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="primary" @click="openAftersale(row)">{{ $t('admin.handle') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-if="!afterSales.length" :description="$t('admin.afterSaleEmpty')" :image-size="70" />
          </div>
        </template>

        <!-- ===== 用户管理 ===== -->
        <template v-if="activeSection === 'users'">
          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.userList') }}</h3>
              <el-input v-model="userKeyword" :placeholder="$t('admin.searchUserPlaceholder')" clearable style="width: 240px" @keyup.enter="loadUsers" @clear="loadUsers">
                <template #append><el-button @click="loadUsers">{{ $t('common.search') }}</el-button></template>
              </el-input>
            </div>
            <el-table :data="userList" size="small">
              <el-table-column prop="id" :label="$t('admin.id')" width="55" />
              <el-table-column :label="$t('admin.userNo')" width="90">
                <template #default="{ row }">
                  <span class="user-no-cell">{{ row.userNo || t('common.unassigned') }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="email" :label="$t('profile.email')" min-width="120" show-overflow-tooltip />
              <el-table-column prop="nickname" :label="$t('admin.nickname')" width="85" show-overflow-tooltip />
              <el-table-column prop="realName" :label="$t('admin.realName')" width="80" show-overflow-tooltip />
              <el-table-column prop="campus" :label="$t('admin.campus')" width="75" />
              <el-table-column :label="$t('admin.role')" width="85">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.role === 'admin' ? 'danger' : 'info'">{{ row.role === 'admin' ? t('common.admin') : t('common.user') }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.status')" width="75">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'banned' ? 'danger' : 'success'">{{ row.status === 'banned' ? t('common.banned') : t('common.normal') }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.balance')" width="95">
                <template #default="{ row }">
                  <span class="balance-cell">¥{{ Number(row.balance ?? 0).toFixed(2) }}</span>
                </template>
              </el-table-column>
              <el-table-column :label="$t('common.actions')" width="300" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="primary" @click="openBalanceDialog(row)">{{ $t('admin.setBalance') }}</el-button>
                  <el-button size="small" text type="primary" @click="openUserNoDialog(row)">{{ $t('admin.changeNo') }}</el-button>
                  <el-button size="small" text type="primary" @click="toggleRole(row)">{{ row.role === 'admin' ? t('common.unmakeAdmin') : t('common.makeAdmin') }}</el-button>
                  <el-button size="small" :type="row.status === 'banned' ? 'success' : 'danger'" plain @click="toggleBan(row)">
                    {{ row.status === 'banned' ? t('common.unban') : t('common.ban') }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="pagination-row">
              <el-pagination
                layout="prev, pager, next"
                :total="userTotal"
                :page-size="userPageSize"
                :current-page="userPage"
                @current-change="(p) => { userPage = p; loadUsers() }"
              />
            </div>
          </div>
        </template>
       </div>
     </div>

    <el-dialog v-model="showUserNoDialog" :title="$t('admin.changeNoTitle')" width="440px">
      <p class="user-no-tip">{{ $t('common.user') }}：{{ userNoForm.nickname }}（{{ $t('admin.currentIdPrefix') }}{{ userNoForm.oldNo }}）</p>
      <el-form label-position="top">
        <el-form-item :label="$t('admin.newNo')">
          <el-input v-model="userNoForm.newNo" :placeholder="$t('admin.newNoPlaceholder')" maxlength="8" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUserNoDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitUserNo">{{ $t('profile.confirmChange') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showAftersaleDialog" :title="$t('admin.handleAfterSale')" width="520px">
      <div v-if="aftersaleForm.row" class="aftersale-detail">
        <p><b>{{ $t('admin.afterSaleOrder') }}：</b>#{{ aftersaleForm.row.orderId }}</p>
        <p><b>{{ $t('admin.afterSaleBuyer') }}：</b>{{ aftersaleForm.row.buyer?.nickname || '—' }}</p>
        <p><b>{{ $t('admin.afterSaleItems') }}：</b>{{ afterSaleItems(aftersaleForm.row) }}</p>
        <p><b>{{ $t('admin.afterSaleReason') }}：</b>{{ aftersaleForm.row.reason || '—' }}</p>
      </div>
      <el-form label-position="top">
        <el-form-item :label="$t('admin.afterSaleStatus')">
          <el-radio-group v-model="aftersaleForm.status">
            <el-radio-button value="processing">{{ $t('admin.afterSaleProcessing') }}</el-radio-button>
            <el-radio-button value="resolved">{{ $t('admin.afterSaleResolved') }}</el-radio-button>
            <el-radio-button value="rejected">{{ $t('admin.afterSaleRejected') }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="$t('admin.afterSaleNote')">
          <el-input
            v-model="aftersaleForm.note"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            :placeholder="$t('admin.afterSaleNotePlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAftersaleDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="handlingAftersale" @click="submitAftersale">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showBalanceDialog" :title="$t('admin.setBalanceTitle')" width="440px">
      <p class="user-no-tip">{{ $t('common.user') }}：{{ balanceForm.nickname }}（{{ $t('admin.currentBalance') }}：¥{{ Number(balanceForm.oldBalance).toFixed(2) }}）</p>
      <el-form label-position="top">
        <el-form-item :label="$t('admin.balance')">
          <el-input-number v-model="balanceForm.newBalance" :min="0" :precision="2" :step="10" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBalanceDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitBalance">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>

   </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index'
import { ElMessageBox } from 'element-plus/es/components/message-box/index'
import {
  DataBoard, ChatDotRound, Bell, Reading, User, Back, Box, ChatLineSquare, Service
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { hotspotApi, notificationApi, adminApi, booksApi } from '@/api'
import { TRADE_CATEGORIES } from '@/constants/categories'
import StatsCharts from '@/components/StatsCharts.vue'
import { resolveImg, imgFallback } from '@/utils/image'

const userStore = useUserStore()
const activeSection = ref('dashboard')
const categories = TRADE_CATEGORIES
const chartData = ref(null)

async function loadCharts() {
  try {
    const res = await adminApi.charts()
    chartData.value = res.data || null
  } catch {}
}
const stats = ref(null)

const statCards = computed(() => [
  { label: t('admin.statUsers'), value: stats.value?.userCount ?? '-', icon: User, color: 'linear-gradient(135deg,#5c6bc0,#3949ab)' },
  { label: t('admin.statProducts'), value: stats.value?.productCount ?? '-', icon: Reading, color: 'linear-gradient(135deg,#26a69a,#00897b)' },
  { label: t('admin.statOrders'), value: stats.value?.orderCount ?? '-', icon: DataBoard, color: 'linear-gradient(135deg,#ec407a,#d81b60)' },
  { label: t('admin.statPlaza'), value: stats.value?.plazaCount ?? '-', icon: ChatLineSquare, color: 'linear-gradient(135deg,#26c6da,#00838f)' },
  { label: t('admin.statBanned'), value: stats.value?.bannedCount ?? '-', icon: Bell, color: 'linear-gradient(135deg,#ef5350,#e53935)' }
])

const sectionTitle = computed(() => ({
  dashboard: t('admin.dashboard'),
  posts: t('admin.posts'),
  notifications: t('admin.notifications'),
  items: t('admin.items'),
  plaza: t('admin.plazaManage'),
  afterSales: t('admin.afterSales'),
  users: t('admin.users')
}[activeSection.value]))

async function loadStats() {
  try {
    const res = await adminApi.stats()
    stats.value = res.data
  } catch {}
}

/* ---- 当日最新 + 近7天上架趋势（仅管理台） ---- */
const homeStats = ref(null)
async function loadHomeStats() {
  try {
    const res = await booksApi.homeStats()
    homeStats.value = res.data
  } catch {}
}
/* ---- 帖子管理 ---- */
const posts = ref([])
async function loadPosts() {
  try {
    const res = await hotspotApi.adminList()
    posts.value = res.data || []
  } catch {}
}
async function movePost(row, direction) {
  try {
    await hotspotApi.move(row.id, direction)
    ElMessage.success(t('admin.orderAdjusted'))
    loadPosts()
  } catch {}
}
async function removePost(row) {
  try {
    await ElMessageBox.confirm(t('admin.deletePostConfirm', { name: row.title }), t('common.hint'), { type: 'warning' })
    await hotspotApi.remove(row.id)
    ElMessage.success(t('common.deleted'))
    loadPosts()
  } catch {}
}
function switchSection(name) {
  activeSection.value = name
  if (name === 'posts') loadPosts()
  if (name === 'users') loadUsers()
  if (name === 'items') loadItems()
  if (name === 'plaza') loadPlaza()
  if (name === 'afterSales') loadAfterSales()
  if (name === 'dashboard') { loadStats(); loadHomeStats(); loadCharts() }
  if (name === 'notifications') loadNotifList()
}

/* ---- 售后管理 ---- */
const afterSales = ref([])
const aftersaleStatus = ref('')
const showAftersaleDialog = ref(false)
const handlingAftersale = ref(false)
const aftersaleForm = ref({ id: null, status: 'processing', note: '', row: null })

async function loadAfterSales() {
  try {
    const res = await adminApi.listAfterSales({ status: aftersaleStatus.value, pageSize: 100 })
    afterSales.value = res.data?.list || []
  } catch {
    afterSales.value = []
  }
}

function afterSaleItems(row) {
  const items = row?.order?.items || []
  return items.map((i) => i.product?.title || i.product?.bookTitle).filter(Boolean).join('、') || '—'
}

function aftersaleStatusLabel(status) {
  const map = {
    pending: 'admin.afterSalePending',
    processing: 'admin.afterSaleProcessing',
    resolved: 'admin.afterSaleResolved',
    rejected: 'admin.afterSaleRejected'
  }
  return map[status] ? t(map[status]) : status
}

function aftersaleTagType(status) {
  return { pending: 'warning', processing: 'primary', resolved: 'success', rejected: 'danger' }[status] || 'info'
}

function openAftersale(row) {
  aftersaleForm.value = {
    id: row.id,
    status: row.status === 'pending' ? 'processing' : row.status,
    note: row.adminNote || '',
    row
  }
  showAftersaleDialog.value = true
}

async function submitAftersale() {
  handlingAftersale.value = true
  try {
    await adminApi.handleAfterSale(aftersaleForm.value.id, {
      status: aftersaleForm.value.status,
      note: aftersaleForm.value.note
    })
    ElMessage.success(t('admin.afterSaleHandled'))
    showAftersaleDialog.value = false
    loadAfterSales()
    loadStats()
  } catch {} finally {
    handlingAftersale.value = false
  }
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ---- 物品管理 ---- */
const itemList = ref([])
const itemTotal = ref(0)
const itemPage = ref(1)
const itemPageSize = 20
const itemKeyword = ref('')
const itemCategory = ref('')

async function loadItems() {
  try {
    const res = await adminApi.listItems({
      keyword: itemKeyword.value,
      category: itemCategory.value,
      page: itemPage.value,
      pageSize: itemPageSize
    })
    itemList.value = res.data?.list || []
    itemTotal.value = res.data?.total || 0
  } catch {
    itemList.value = []
    itemTotal.value = 0
  }
}

function itemCover(row) {
  const first = row.images?.[0]
  const firstPath = typeof first === 'string' ? first : first?.imagePath
  return resolveImg(row.bookCover || firstPath)
}

async function changeItemCategory(row, value) {
  try {
    await adminApi.updateItem(row.id, { category: value })
    row.category = value
    ElMessage.success(t('admin.itemUpdated'))
  } catch {
    ElMessage.error(t('admin.itemUpdateFail'))
    loadItems()
  }
}

async function removeItem(row) {
  const name = row.bookTitle || row.title || `#${row.id}`
  try {
    await ElMessageBox.confirm(t('admin.itemDeleteConfirm', { name }), t('common.warning'), { type: 'warning' })
    await adminApi.deleteItem(row.id)
    ElMessage.success(t('admin.itemDeleted'))
    loadItems()
  } catch {}
}

/* ---- 广场管理 ---- */
const plazaList = ref([])
const plazaKeyword = ref('')

async function loadPlaza() {
  try {
    const res = await adminApi.listPlaza({ keyword: plazaKeyword.value, pageSize: 50 })
    plazaList.value = res.data?.list || []
  } catch {
    plazaList.value = []
  }
}

async function togglePlaza(row) {
  const next = row.status === 'active' ? 'hidden' : 'active'
  try {
    await adminApi.updatePlaza(row.id, { status: next })
    row.status = next
    ElMessage.success(next === 'hidden' ? t('admin.plazaHiddenTip') : t('admin.plazaVisibleTip'))
  } catch {}
}

async function removePlaza(row) {
  try {
    await ElMessageBox.confirm(t('admin.plazaDeleteConfirm'), t('common.warning'), { type: 'warning' })
    await adminApi.deletePlaza(row.id)
    ElMessage.success(t('common.deleted'))
    loadPlaza()
  } catch {}
}

/* ---- 通知管理 ---- */
const broadcastContent = ref('')
const singleUserId = ref(null)
const singleContent = ref('')
const userOptions = ref([])

async function broadcast() {
  if (!broadcastContent.value) {
    ElMessage.warning(t('admin.needNotifContent'))
    return
  }
  try {
    await notificationApi.broadcast(broadcastContent.value)
    ElMessage.success(t('admin.broadcastSent'))
    broadcastContent.value = ''
  } catch {}
}
async function loadUsersForSelect() {
  try {
    const res = await adminApi.users({ page: 1, pageSize: 100 })
    userOptions.value = res.data?.list || []
  } catch {}
}
async function sendSingle() {
  if (!singleUserId.value || !singleContent.value) {
    ElMessage.warning(t('admin.needSelectUser'))
    return
  }
  try {
    await notificationApi.sendToOne(singleUserId.value, singleContent.value)
    ElMessage.success(t('admin.notifSent'))
    singleContent.value = ''
    loadNotifList()
  } catch {}
}

const notifList = ref([])
async function loadNotifList() {
  try {
    const res = await adminApi.listNotifications()
    notifList.value = res.data || []
  } catch {}
}
async function deleteNotif(row) {
  try {
    await ElMessageBox.confirm(t('admin.deleteNotifConfirm'), t('common.warning'), { type: 'warning' })
    await adminApi.deleteNotification(row.id)
    ElMessage.success(t('admin.notifDeleted'))
    loadNotifList()
  } catch {}
}

/* ---- 用户管理 ---- */
const userList = ref([])
const userTotal = ref(0)
const userPage = ref(1)
const userPageSize = 10
const userKeyword = ref('')

async function loadUsers() {
  try {
    const res = await adminApi.users({ page: userPage.value, pageSize: userPageSize, keyword: userKeyword.value })
    userList.value = res.data?.list || []
    userTotal.value = res.data?.total || 0
  } catch {}
}
async function toggleBan(row) {
  const ban = row.status !== 'banned'
  try {
    await ElMessageBox.confirm(ban ? t('admin.banConfirm', { name: row.nickname }) : t('admin.unbanConfirm', { name: row.nickname }), t('common.hint'), { type: 'warning' })
    await adminApi.updateUser(row.id, { status: ban ? 'banned' : 'active' })
    ElMessage.success(ban ? t('common.banned') : t('admin.unbanned'))
    loadUsers()
  } catch {}
}
async function toggleRole(row) {
  const makeAdmin = row.role !== 'admin'
  try {
    await ElMessageBox.confirm(makeAdmin ? t('admin.makeAdminConfirm', { name: row.nickname }) : t('admin.unmakeAdminConfirm', { name: row.nickname }), t('common.hint'), { type: 'warning' })
    await adminApi.updateUser(row.id, { role: makeAdmin ? 'admin' : 'user' })
    ElMessage.success(t('common.success'))
    if (row.id === userStore.userInfo?.id) {
      userStore.userInfo.role = makeAdmin ? 'admin' : 'user'
    }
    loadUsers()
  } catch {}
}

const showUserNoDialog = ref(false)
const userNoForm = ref({ id: null, nickname: '', oldNo: '', newNo: '' })

function openUserNoDialog(row) {
  userNoForm.value = { id: row.id, nickname: row.nickname, oldNo: row.userNo || t('common.unassigned'), newNo: row.userNo || '' }
  showUserNoDialog.value = true
}

async function submitUserNo() {
  const { id, newNo, oldNo } = userNoForm.value
  if (!newNo || !/^\d{8}$/.test(newNo)) {
    ElMessage.warning(t('admin.id8Digits'))
    return
  }
  if (newNo === oldNo) {
    ElMessage.warning(t('admin.idSame'))
    return
  }
  try {
    await adminApi.updateUserNo(id, newNo)
    ElMessage.success(t('admin.idChanged'))
    showUserNoDialog.value = false
    loadUsers()
  } catch {}
}

const showBalanceDialog = ref(false)
const balanceForm = ref({ id: null, nickname: '', oldBalance: 0, newBalance: 0 })

function openBalanceDialog(row) {
  balanceForm.value = {
    id: row.id,
    nickname: row.nickname,
    oldBalance: Number(row.balance ?? 0),
    newBalance: Number(row.balance ?? 0)
  }
  showBalanceDialog.value = true
}

async function submitBalance() {
  const { id, newBalance } = balanceForm.value
  if (newBalance == null || newBalance < 0) {
    ElMessage.warning(t('admin.balanceInvalid'))
    return
  }
  try {
    await adminApi.updateUser(id, { balance: Number(newBalance) })
    ElMessage.success(t('admin.balanceSet'))
    showBalanceDialog.value = false
    loadUsers()
  } catch {}
}

onMounted(() => {
  loadStats()
  loadHomeStats()
  loadCharts()
})
</script>

<style scoped>
.admin-page {
  display: flex;
  min-height: calc(100vh - 64px);
  background: transparent;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(180, 160, 120, 0.25);
  box-shadow: 0 10px 40px rgba(60, 50, 30, 0.12);
}

/* 侧边栏 */
.admin-sidebar {
  width: 220px;
  background: linear-gradient(180deg, #1e2430 0%, #171c26 100%);
  color: #d8d2c2;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.admin-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.logo-seal {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: #b5442f;
  color: #f7f3ea;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(181, 68, 47, 0.4);
}
.logo-text b {
  display: block;
  font-size: 16px;
  letter-spacing: 2px;
  color: #efe8dc;
}
.logo-text span {
  font-size: 10px;
  letter-spacing: 2px;
  color: rgba(216, 210, 194, 0.5);
}
.admin-menu {
  flex: 1;
  border: none;
  background: transparent;
  --el-menu-text-color: #c8c2b2;
  --el-menu-hover-bg-color: rgba(255, 255, 255, 0.06);
  --el-menu-active-color: #d6b56a;
  --el-menu-bg-color: transparent;
}
.admin-menu :deep(.el-menu-item) {
  height: 50px;
  margin: 4px 10px;
  border-radius: 10px;
}
.admin-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, rgba(214, 181, 106, 0.18), rgba(214, 181, 106, 0.06));
  color: #d6b56a;
}
.admin-sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.back-btn {
  color: #c8c2b2;
  width: 100%;
  justify-content: flex-start;
}

/* 主区 */
.admin-main {
  flex: 1;
  background: linear-gradient(180deg, rgba(255, 253, 248, 0.95), rgba(247, 242, 230, 0.95));
  padding: 24px 28px;
  min-width: 0;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.admin-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 3px;
  color: #3b3020;
  font-family: 'KaiTi', 'STKaiti', serif;
}
.admin-user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #6b5c40;
}
.admin-role-tag {
  background: #b5442f;
  color: #fff;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  letter-spacing: 1px;
}
.admin-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 统计卡片 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.stat-card {
  background: #fff;
  border-radius: 14px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(180, 160, 120, 0.2);
  box-shadow: 0 4px 16px rgba(60, 50, 30, 0.07);
  transition: all 0.3s;
}
.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(60, 50, 30, 0.12);
}
.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-num {
  display: block;
  font-size: 24px;
  color: #3b3020;
}
.stat-label {
  font-size: 12px;
  color: #9a8a6c;
}

/* 面板 */
.panel {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 14px;
  padding: 20px;
  border: 1px solid rgba(180, 160, 120, 0.2);
  box-shadow: 0 4px 16px rgba(60, 50, 30, 0.06);
}
.panel-title {
  font-size: 16px;
  color: #3b3020;
  margin-bottom: 16px;
  font-weight: 700;
  letter-spacing: 1px;
}
.panel-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.panel-toolbar .panel-title {
  margin-bottom: 0;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-actions {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}
.item-cat {
  width: 100%;
}
.item-cat :deep(.el-select__wrapper) {
  min-height: 28px;
}
.plaza-content {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  color: #37474f;
}
.plaza-thumbs {
  display: flex;
  align-items: center;
  gap: 4px;
}
.plaza-thumbs img {
  width: 34px;
  height: 34px;
  object-fit: cover;
  border-radius: 5px;
}
.plaza-thumbs .more {
  font-size: 11px;
  color: #90a4ae;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}
.menu-badge {
  margin-left: auto;
  transform: scale(0.85);
}
.aftersale-detail {
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(26, 144, 160, 0.06);
  font-size: 13px;
  line-height: 1.7;
  color: #37474f;
}
.aftersale-detail p {
  margin: 0;
}

.muted-text {
  color: #9a8a6c;
  font-size: 13px;
}
.single-send-row {
  display: flex;
  gap: 12px;
  align-items: center;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0 20px;
}
.book-admin-form :deep(.el-form-item__label) {
  font-weight: 600;
  color: #5c4a28;
}
.pagination-row {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 860px) {
  .admin-page { flex-direction: column; }
  .admin-sidebar { width: 100%; }
  .single-send-row { flex-direction: column; align-items: flex-start; }
}
.user-no-cell {
  font-weight: 600;
  color: #42a5f5;
  letter-spacing: 1px;
}
.user-no-tip {
  margin-bottom: 16px;
  color: #607d8b;
  font-size: 14px;
}
.balance-cell {
  font-weight: 600;
  color: #26a69a;
}

/* 当日最新 + 近7天上架趋势（管理台） */
.admin-today-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 4px;
}
.admin-today-card {
  flex: 1;
  background: #fff;
  border-radius: 14px;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid rgba(180, 160, 120, 0.2);
  box-shadow: 0 4px 16px rgba(60, 50, 30, 0.07);
  transition: all 0.3s;
}
.admin-today-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(60, 50, 30, 0.12);
}
.admin-today-boards {
  border-left: 4px solid #42a5f5;
}
.admin-today-books {
  border-left: 4px solid #66bb6a;
}
.admin-today-icon {
  font-size: 34px;
}
.admin-today-num {
  font-size: 30px;
  font-weight: 700;
  color: #3b3020;
  line-height: 1.2;
}
.admin-today-label {
  font-size: 13px;
  color: #9a8a6c;
  margin-top: 4px;
}
.chart-container {
  background: #fff;
  border-radius: 14px;
  padding: 24px 20px;
  border: 1px solid rgba(180, 160, 120, 0.2);
}
.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 200px;
  gap: 12px;
}
.bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}
.bar-wrapper {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.bar-fill {
  width: 70%;
  max-width: 48px;
  background: linear-gradient(180deg, #42a5f5, #1e88e5);
  border-radius: 8px 8px 0 0;
  transition: all 0.5s ease;
  position: relative;
  min-height: 4px;
}
.bar-count {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  font-weight: 600;
  color: #1e88e5;
}
.bar-label {
  margin-top: 8px;
  font-size: 13px;
  color: #78909c;
}
</style>