package com.unifiedcloud.filemanager.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.unifiedcloud.filemanager.data.db.dao.AccountDao
import com.unifiedcloud.filemanager.data.db.dao.FileDao
import com.unifiedcloud.filemanager.data.db.dao.PendingOperationDao
import com.unifiedcloud.filemanager.data.db.entity.AccountStateEntity
import com.unifiedcloud.filemanager.data.db.entity.ConnectedAccountEntity
import com.unifiedcloud.filemanager.data.db.entity.FavoriteFileEntity
import com.unifiedcloud.filemanager.data.db.entity.FileMetadataEntity
import com.unifiedcloud.filemanager.data.db.entity.PendingOperationEntity
import com.unifiedcloud.filemanager.data.db.entity.RecentFileEntity
import com.unifiedcloud.filemanager.data.db.entity.SyncStateEntity
import com.unifiedcloud.filemanager.data.db.entity.TokenSetEntity

/**
 * The local cache. Device-local by design (MA-12): no account, no sync service,
 * no server copy of the user's metadata.
 */
@Database(
    entities = [
        ConnectedAccountEntity::class,
        AccountStateEntity::class,
        TokenSetEntity::class,
        FileMetadataEntity::class,
        SyncStateEntity::class,
        RecentFileEntity::class,
        FavoriteFileEntity::class,
        PendingOperationEntity::class,
    ],
    version = AppDatabase.SCHEMA_VERSION,
    exportSchema = true,
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun accountDao(): AccountDao
    abstract fun fileDao(): FileDao
    abstract fun pendingOperationDao(): PendingOperationDao

    companion object {
        /**
         * The schema version is a constant that tests assert against, so an
         * entity change without a migration fails CI rather than production
         * (MIG-5). Bump it in the same commit that adds the `Migration`.
         */
        const val SCHEMA_VERSION = 1

        const val DATABASE_NAME = "unified_cloud_file_manager.db"

        @Volatile
        private var instance: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context.applicationContext).also { instance = it }
            }

        private fun build(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, DATABASE_NAME)
                // NOTE: fallbackToDestructiveMigration() is deliberately ABSENT and
                // must stay absent (MIG-2). Adding it would silently delete the
                // user's cached metadata - and, because ConnectedAccount and
                // TokenSet are in the same database, quite possibly their tokens
                // too - on any future schema bump. A build-time failure is the
                // intended outcome of forgetting a migration.
                //
                // There is also no .fallbackToDestructiveMigrationOnDowngrade():
                // a downgrade means a bad install, and wiping a user's credentials
                // because of it is not an acceptable response.
                .build()

        /** Test seam. Instrumented tests need a fresh, isolated database per case. */
        internal fun overrideForTest(database: AppDatabase?) {
            instance = database
        }
    }
}
