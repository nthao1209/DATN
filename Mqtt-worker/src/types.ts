export interface AppConfig {
    // File config quyết định worker nghe broker nào, ghi DB nào và topic attendance nào.
    project_name: string;
    mqtt: {
        host: string;
        port: number;
        protocol: 'mqtt' | 'mqtts' | 'tcp';
        path?: string;
        topic: string;
        uiTopicPrefix?: string;
        dashboardTopicPrefix?: string;
        username: string; 
        password: string;
        qos?: 0 | 1 | 2;
    };
    postgres: {
        host: string;
        user: string;
        password: string;
        port: number;
        database: string;
        table: string;
    };
    data_struct: {
        format?: 'json';
        columns: string[];
        types: ('float' | 'int' | 'number' | 'boolean' | 'string')[];
        DeviceId?: boolean;
    };
    aggregation: {
        interval_seconds: number;
        target_columns: string[];
        method?: 'average' | 'copy';
    };
}
