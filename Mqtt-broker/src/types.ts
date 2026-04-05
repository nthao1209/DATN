export interface AppConfig {
    project_name: string;
    mqtt: {
        host: string;
        port: number;
        protocol: 'mqtt' | 'mqtts' | 'tcp';
        path?: string;
        topic: string;
        username: string; 
        password: string;
    };
    mysql: {
        host: string;
        user: string;
        password: "";
        database: string;
        table: string;
    };
    data_struct: {
        columns: string[];
        types: ('float' | 'int' | 'string')[];
        DeviceId?: boolean;
    };
    aggregation: {
        interval_seconds: number;
        target_columns: string[];
        method?: 'average' | 'copy';
    };
}